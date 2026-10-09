import type * as Monaco from 'monaco-editor'
import type { LanguageServerLanguage, LanguageServerRequest } from '../../../shared/language-server'
import { LANGUAGE_SERVER_LANGUAGES } from '../../../shared/language-server'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { detectLanguage } from '@/lib/language-detect'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { modelFileFor } from './diff-editor-model-files'
import { builtInTypeScriptDefinition, builtInTypeScriptHover } from './built-in-typescript-fallback'
import {
  definitionOpenTarget,
  languageServerEnabled,
  openFileContext,
  serverLanguageFor,
  targetHasDiff,
  toEditorPosition,
  trackedFileContext
} from './language-server-editor'

const MONACO_LANGUAGE_IDS = ['python', 'typescript', 'javascript']

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

function openDefinition(
  source: { worktreeId: string; worktreeRoot: string; fromDiff: boolean },
  targetFilePath: string,
  line: number,
  column: number
) {
  const store = useAppStore.getState()
  const target = definitionOpenTarget(store, source.worktreeId, targetFilePath)
  if (!target) {
    return false
  }
  activateAndRevealWorktree(target.worktreeId, { providesInitialSurface: true })
  // Why: reading a diff, a jump into another changed file should land in that file's diff too.
  if (
    source.fromDiff &&
    target.relativePath !== target.filePath &&
    targetHasDiff(store, target.worktreeId, target.relativePath)
  ) {
    store.openDiffAtLocation({
      worktreeId: target.worktreeId,
      worktreePath: source.worktreeRoot,
      relativePath: target.relativePath,
      line,
      preview: false
    })
    return true
  }
  store.openFile(
    {
      filePath: target.filePath,
      relativePath: target.relativePath,
      worktreeId: target.worktreeId,
      language: detectLanguage(target.relativePath),
      mode: 'edit'
    },
    { forceContentReload: true }
  )
  store.setPendingEditorReveal(null)
  // Why two frames: opening can swap the active tab and mount Monaco before it can reveal a line.
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      useAppStore
        .getState()
        .setPendingEditorReveal({ filePath: target.filePath, line, column, matchLength: 0 })
    )
  )
  return true
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
              uri: sameFile ? model.uri : monaco.Uri.file(location.filePath),
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
      if (
        !sourceUri ||
        !source ||
        resource.scheme !== 'file' ||
        resource.toString() === sourceUri.toString()
      ) {
        return false
      }
      const start =
        selectionOrPosition && 'startLineNumber' in selectionOrPosition
          ? { line: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
          : { line: selectionOrPosition?.lineNumber ?? 1, column: selectionOrPosition?.column ?? 1 }
      return openDefinition(source, resource.fsPath, start.line, start.column)
    }
  })

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
