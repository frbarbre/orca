import type * as Monaco from 'monaco-editor'
import { useAppStore } from '@/store'
import type { CodeLocation } from './code-navigation-history'
import {
  goInCodeHistory,
  jumpToCode,
  recordCodeJump,
  setCurrentCodeLocationReader
} from './code-navigation'
import { definitionOpenTarget, targetHasDiff } from './language-server-editor'
import { fileSource } from './language-server-file-source'
import { isWholeFileCopy, PREVIEW_SCHEME } from './language-server-preview-models'
import { installLanguageServerProviders } from './monaco-language-server-providers'

const MOUSE_BACK_BUTTON = 3
const MOUSE_FORWARD_BUTTON = 4

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

// Why: Monaco reads this once at setup, so its own TS hover/definition/references stay off for
// good and the registry's TypeScript fallback calls the built-in worker only when asked.
function turnOffBuiltInTypeScriptProviders(monacoTS: typeof Monaco.typescript): void {
  for (const defaults of [monacoTS.typescriptDefaults, monacoTS.javascriptDefaults]) {
    defaults.setModeConfiguration({
      ...defaults.modeConfiguration,
      definitions: false,
      hovers: false,
      references: false,
      completionItems: false
    })
  }
}

// Fork: Cmd+click, hover and references through each language's server (see
// `shared/language-server.ts`), plus the jumps and back/forward history they produce.
export function installMonacoLanguageServers(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript
): void {
  turnOffBuiltInTypeScriptProviders(monacoTS)
  installLanguageServerProviders(monaco, monacoTS)

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
      // Why false for the same model: Monaco moves within the open editor itself. A Peek copy is
      // not a tab, so a jump from it opens the real file like a Cmd+click in the file does.
      if (sameModel && !isWholeFileCopy(resource)) {
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
}
