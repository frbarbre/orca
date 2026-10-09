import type * as Monaco from 'monaco-editor'
import type {
  LanguageServerLanguage,
  LanguageServerLocation,
  LanguageServerRequest
} from '../../../shared/language-server'
import { LANGUAGE_SERVER_LANGUAGES } from '../../../shared/language-server'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { modelFileFor } from './diff-editor-model-files'
import { builtInTypeScriptDefinition, builtInTypeScriptHover } from './built-in-typescript-fallback'
import type { CodeLocation } from './code-navigation-history'
import {
  goInCodeHistory,
  jumpToCode,
  recordCodeJump,
  setCurrentCodeLocationReader
} from './code-navigation'
import {
  definitionOpenTarget,
  languageServerEnabled,
  openFileContext,
  previewModelText,
  serverLanguageFor,
  targetHasDiff,
  toEditorPosition,
  trackedFileContext
} from './language-server-editor'

const MONACO_LANGUAGE_IDS = ['python', 'typescript', 'javascript']
const PREVIEW_SCHEME = 'orca-definition'
const MAX_PREVIEW_MODELS = 20
const MOUSE_BACK_BUTTON = 3
const MOUSE_FORWARD_BUTTON = 4

function fileSource(uri: Monaco.Uri) {
  const state = useAppStore.getState()
  const tracked = modelFileFor(uri.toString())
  if (tracked) {
    const context = trackedFileContext(state, tracked)
    return context ? { ...context, fromDiff: true } : null
  }
  // A fragment marks a remote or runtime-owned model; the servers only see local checkouts.
  if (uri.scheme !== 'file' || uri.fragment) {
    return null
  }
  const context = openFileContext(state, uri.fsPath)
  return context ? { filePath: uri.fsPath, ...context, fromDiff: false } : null
}

function serverRequest(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): (LanguageServerRequest & ReturnType<typeof fileSource>) | null {
  const language = serverLanguageFor(model.getLanguageId())
  if (!language || !languageServerEnabled(useAppStore.getState().settings, language)) {
    return null
  }
  const source = fileSource(model.uri)
  return source
    ? {
        ...source,
        language,
        text: model.getValue(),
        line: position.lineNumber - 1,
        character: position.column - 1
      }
    : null
}

function codeLocation(
  source: { worktreeId: string; worktreeRoot: string; filePath: string; fromDiff: boolean },
  filePath: string,
  position: { line: number; column: number }
): CodeLocation | null {
  const state = useAppStore.getState()
  const target = definitionOpenTarget(state, source.worktreeId, filePath)
  if (!target) {
    return null
  }
  // Why: reading a diff, a place in another changed file is shown in that file's diff too.
  const inDiff =
    source.fromDiff &&
    (filePath === source.filePath ||
      (target.relativePath !== target.filePath &&
        targetHasDiff(state, target.worktreeId, target.relativePath)))
  return {
    worktreeId: target.worktreeId,
    worktreeRoot: source.worktreeRoot,
    filePath,
    relativePath: target.relativePath,
    line: position.line,
    column: position.column,
    inDiff
  }
}

function editorLocation(editor: Monaco.editor.ICodeEditor): CodeLocation | null {
  const uri = editor.getModel()?.uri
  const position = editor.getPosition()
  const source = uri ? fileSource(uri) : null
  return source && position
    ? codeLocation(source, source.filePath, { line: position.lineNumber, column: position.column })
    : null
}

// Why a model per target: Monaco underlines a Cmd+hovered name only once it can load the target's
// model, and standalone Monaco loads none it doesn't already hold.
function previewModelUri(monaco: typeof Monaco, location: LanguageServerLocation): Monaco.Uri {
  const uri = monaco.Uri.file(location.filePath).with({ scheme: PREVIEW_SCHEME })
  const text = previewModelText(location)
  const existing = monaco.editor.getModel(uri)
  if (existing) {
    if (existing.getValue() !== text) {
      existing.setValue(text)
    }
    return uri
  }
  const previews = monaco.editor.getModels().filter((model) => model.uri.scheme === PREVIEW_SCHEME)
  for (const stale of previews.slice(0, Math.max(0, previews.length - MAX_PREVIEW_MODELS + 1))) {
    stale.dispose()
  }
  monaco.editor.createModel(text, 'plaintext', uri)
  return uri
}

const reportedFailures = new Set<string>()

// Why once per message: hover fires constantly, and a missing server would otherwise fail silently.
function reportServerFailure(language: LanguageServerLanguage, error: string): void {
  const key = `${language}:${error}`
  if (reportedFailures.has(key)) {
    return
  }
  reportedFailures.add(key)
  toast.error(
    language === 'python'
      ? translate(
          'auto.lib.languageServer.pythonUnavailable',
          'Python go-to-definition is unavailable ({{error}}). Set a Python Environment in the project settings.',
          { error }
        )
      : translate(
          'auto.lib.languageServer.typescriptUnavailable',
          'TypeScript go-to-definition is unavailable ({{error}}). Add @typescript/native-preview (tsgo) to the project.',
          { error }
        )
  )
}

// Why: Monaco reads this once at setup, so its own TS hover/definition stay off for good and the
// providers below call the built-in worker themselves whenever tsgo is off or can't answer.
function turnOffBuiltInTypeScriptProviders(monacoTS: typeof Monaco.typescript): void {
  for (const defaults of [monacoTS.typescriptDefaults, monacoTS.javascriptDefaults]) {
    defaults.setModeConfiguration({
      ...defaults.modeConfiguration,
      definitions: false,
      hovers: false
    })
  }
}

function hasBuiltInTypeScript(model: Monaco.editor.ITextModel): boolean {
  return serverLanguageFor(model.getLanguageId()) === 'typescript'
}

// Fork: Cmd+click and hover in local Python (pyrefly) and TypeScript/JavaScript (tsgo) files,
// including either side of a diff; each language can be switched off in Settings.
export function installMonacoLanguageServers(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript
): void {
  turnOffBuiltInTypeScriptProviders(monacoTS)

  for (const languageId of MONACO_LANGUAGE_IDS) {
    monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model, position) => {
        const request = serverRequest(model, position)
        if (request) {
          const result = await window.api.languageServer.definition(request)
          if (!result.ok) {
            reportServerFailure(request.language, result.error)
          }
          const location = result.ok ? result.locations[0] : undefined
          if (location) {
            const { lineNumber, column } = toEditorPosition(location)
            // Why the diff's own model for a same-file hit: the jump then stays in the diff editor.
            const sameFile = location.filePath === request.filePath
            return {
              uri: sameFile ? model.uri : previewModelUri(monaco, location),
              range: new monaco.Range(lineNumber, column, lineNumber, column)
            }
          }
        }
        return hasBuiltInTypeScript(model)
          ? builtInTypeScriptDefinition(monaco, monacoTS, model, position)
          : null
      }
    })

    monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position) => {
        const request = serverRequest(model, position)
        const result = request ? await window.api.languageServer.hover(request) : null
        if (result?.ok && result.markdown) {
          const word = model.getWordAtPosition(position)
          return {
            contents: [{ value: result.markdown }],
            range: word
              ? new monaco.Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                )
              : undefined
          }
        }
        return hasBuiltInTypeScript(model)
          ? builtInTypeScriptHover(monaco, monacoTS, model, position)
          : null
      }
    })
  }

  // Why: standalone Monaco cannot open another file itself, so route a jump to an Orca tab.
  monaco.editor.registerEditorOpener({
    openCodeEditor: (sourceEditor, resource, selectionOrPosition) => {
      const sourceUri = sourceEditor.getModel()?.uri
      const source = sourceUri ? fileSource(sourceUri) : null
      const from = editorLocation(sourceEditor)
      const sameModel = resource.toString() === sourceUri?.toString()
      if (!source || !from || (!sameModel && ![PREVIEW_SCHEME, 'file'].includes(resource.scheme))) {
        return false
      }
      const start =
        selectionOrPosition && 'startLineNumber' in selectionOrPosition
          ? { line: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
          : { line: selectionOrPosition?.lineNumber ?? 1, column: selectionOrPosition?.column ?? 1 }
      const targetPath = sameModel ? source.filePath : resource.with({ scheme: 'file' }).fsPath
      const to = codeLocation(source, targetPath, start)
      if (!to) {
        return false
      }
      // Why false for the same model: Monaco moves within the open editor itself.
      if (sameModel) {
        recordCodeJump(from, to)
        return false
      }
      jumpToCode(from, to)
      return true
    }
  })

  let lastFocusedEditor: Monaco.editor.ICodeEditor | null = null
  monaco.editor.onDidCreateEditor((editor) => {
    editor.onDidFocusEditorText(() => {
      lastFocusedEditor = editor
    })
  })
  setCurrentCodeLocationReader(() => (lastFocusedEditor ? editorLocation(lastFocusedEditor) : null))

  // Why mouseup: Chromium reports the mouse's back/forward buttons as buttons 3 and 4.
  window.addEventListener(
    'mouseup',
    (event) => {
      if (event.button === MOUSE_BACK_BUTTON || event.button === MOUSE_FORWARD_BUTTON) {
        event.preventDefault()
        goInCodeHistory(event.button === MOUSE_BACK_BUTTON ? 'back' : 'forward')
      }
    },
    true
  )

  const enabledLanguages = (): Record<LanguageServerLanguage, boolean> => {
    const settings = useAppStore.getState().settings
    return {
      python: languageServerEnabled(settings, 'python'),
      typescript: languageServerEnabled(settings, 'typescript')
    }
  }
  let enabled = enabledLanguages()
  useAppStore.subscribe((state, previous) => {
    if (state.settings === previous.settings) {
      return
    }
    const next = enabledLanguages()
    for (const language of LANGUAGE_SERVER_LANGUAGES) {
      if (enabled[language] && !next[language]) {
        void window.api.languageServer.stop({ language })
      }
    }
    enabled = next
  })
}
