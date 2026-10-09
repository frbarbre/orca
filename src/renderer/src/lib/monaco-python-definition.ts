import type * as Monaco from 'monaco-editor'
import { detectLanguage } from '@/lib/language-detect'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { modelFileFor } from './diff-editor-model-files'
import {
  definitionOpenTarget,
  pythonDefinitionContext,
  targetHasDiff,
  toEditorPosition,
  trackedFileContext
} from './python-definition'

function definitionSource(uri: Monaco.Uri) {
  const state = useAppStore.getState()
  const tracked = modelFileFor(uri.toString())
  if (tracked) {
    const context = trackedFileContext(state, tracked)
    return context ? { ...context, fromDiff: true } : null
  }
  // A fragment marks a remote or runtime-owned model; pyrefly only sees local checkouts.
  if (uri.scheme !== 'file' || uri.fragment) {
    return null
  }
  const context = pythonDefinitionContext(state, uri.fsPath)
  return context ? { filePath: uri.fsPath, ...context, fromDiff: false } : null
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

// Fork: Cmd+click in a local Python file, or either side of its diff, asks pyrefly (main process)
// where the symbol is defined.
export function installMonacoPythonDefinition(monaco: typeof Monaco): void {
  monaco.languages.registerDefinitionProvider('python', {
    provideDefinition: async (model, position) => {
      const source = definitionSource(model.uri)
      if (!source) {
        return null
      }
      const result = await window.api.python.definition({
        filePath: source.filePath,
        worktreeRoot: source.worktreeRoot,
        venvSetting: source.venvSetting,
        text: model.getValue(),
        line: position.lineNumber - 1,
        character: position.column - 1
      })
      const location = result.ok ? result.locations[0] : undefined
      if (!location) {
        return null
      }
      const { lineNumber, column } = toEditorPosition(location)
      // Why the diff's own model for a same-file hit: the jump then stays in the diff editor.
      const sameFile = location.filePath === source.filePath
      return {
        uri: sameFile ? model.uri : monaco.Uri.file(location.filePath),
        range: new monaco.Range(lineNumber, column, lineNumber, column)
      }
    }
  })

  monaco.languages.registerHoverProvider('python', {
    provideHover: async (model, position) => {
      const source = definitionSource(model.uri)
      if (!source) {
        return null
      }
      const result = await window.api.python.hover({
        filePath: source.filePath,
        worktreeRoot: source.worktreeRoot,
        venvSetting: source.venvSetting,
        text: model.getValue(),
        line: position.lineNumber - 1,
        character: position.column - 1
      })
      if (!result.ok || !result.markdown) {
        return null
      }
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
  })

  // Why: standalone Monaco cannot open another file itself, so route a jump to an Orca tab.
  monaco.editor.registerEditorOpener({
    openCodeEditor: (sourceEditor, resource, selectionOrPosition) => {
      const sourceUri = sourceEditor.getModel()?.uri
      const source = sourceUri ? definitionSource(sourceUri) : null
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
}
