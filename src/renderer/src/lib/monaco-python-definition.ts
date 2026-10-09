import type * as Monaco from 'monaco-editor'
import { detectLanguage } from '@/lib/language-detect'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import {
  definitionOpenTarget,
  pythonDefinitionContext,
  toEditorPosition
} from './python-definition'

function openDefinition(
  sourceFilePath: string,
  targetFilePath: string,
  line: number,
  column: number
): boolean {
  const store = useAppStore.getState()
  const target = definitionOpenTarget(store, sourceFilePath, targetFilePath)
  if (!target) {
    return false
  }
  activateAndRevealWorktree(target.worktreeId, { providesInitialSurface: true })
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

// Fork: Cmd+click in a local Python file asks pyrefly (main process) where the symbol is defined.
export function installMonacoPythonDefinition(monaco: typeof Monaco): void {
  monaco.languages.registerDefinitionProvider('python', {
    provideDefinition: async (model, position) => {
      // A fragment marks a remote or runtime-owned model; pyrefly only sees local checkouts.
      if (model.uri.scheme !== 'file' || model.uri.fragment) {
        return null
      }
      const filePath = model.uri.fsPath
      const context = pythonDefinitionContext(useAppStore.getState(), filePath)
      if (!context) {
        return null
      }
      const result = await window.api.python.definition({
        filePath,
        worktreeRoot: context.worktreeRoot,
        venvSetting: context.venvSetting,
        text: model.getValue(),
        line: position.lineNumber - 1,
        character: position.column - 1
      })
      const location = result.ok ? result.locations[0] : undefined
      if (!location) {
        return null
      }
      const { lineNumber, column } = toEditorPosition(location)
      return {
        uri: monaco.Uri.file(location.filePath),
        range: new monaco.Range(lineNumber, column, lineNumber, column)
      }
    }
  })

  // Why: standalone Monaco cannot open another file itself, so route a jump to an Orca tab.
  monaco.editor.registerEditorOpener({
    openCodeEditor: (source, resource, selectionOrPosition) => {
      const sourceUri = source.getModel()?.uri
      if (
        !sourceUri ||
        sourceUri.fragment ||
        resource.scheme !== 'file' ||
        resource.fsPath === sourceUri.fsPath
      ) {
        return false
      }
      const start =
        selectionOrPosition && 'startLineNumber' in selectionOrPosition
          ? { line: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
          : { line: selectionOrPosition?.lineNumber ?? 1, column: selectionOrPosition?.column ?? 1 }
      return openDefinition(sourceUri.fsPath, resource.fsPath, start.line, start.column)
    }
  })
}
