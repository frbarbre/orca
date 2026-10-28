import { useAppStore } from '@/store'
import { getChangesFilter } from '@/lib/changes-filter'
import { detectLanguage } from '@/lib/language-detect'
import type { MarkdownViewMode } from '@/store/slices/editor'
import { requestEditorFileSave } from './editor-autosave'
import { revealLineAfterOpen } from './reveal-line-after-open'

type AppState = ReturnType<typeof useAppStore.getState>

// Why: mirrors openDiffAtLocation's 'branch-worktree' routing, so the toggle only offers a diff
// that the Source Control panel would list under its current filter. A previewed commit or turn
// opens its own diff tab, which has no editor to switch back to.
function filterShowsFile(state: AppState, worktreeId: string, relativePath: string): boolean {
  const isPath = (entry: { path: string }): boolean => entry.path === relativePath
  const filter = getChangesFilter(worktreeId)
  if (filter && filter.kind !== 'uncommitted') {
    return false
  }
  if ((state.gitStatusByWorktree[worktreeId] ?? []).some(isPath)) {
    return true
  }
  return !filter && state.gitBranchCompareSummaryByWorktree[worktreeId]?.status === 'ready'
}

export async function showFileDiff(fileId: string): Promise<boolean> {
  const state = useAppStore.getState()
  const file = state.openFiles.find((candidate) => candidate.id === fileId)
  const worktreePath = file ? state.getKnownWorktreeById(file.worktreeId)?.path : undefined
  if (
    !file ||
    file.mode !== 'edit' ||
    !worktreePath ||
    !filterShowsFile(state, file.worktreeId, file.relativePath)
  ) {
    return false
  }
  if (file.isDirty) {
    try {
      await requestEditorFileSave({ fileId })
    } catch {
      return false
    }
  }
  const latest = useAppStore.getState()
  const line = latest.editorCursorLine[fileId]
  latest.openDiffAtLocation({
    worktreeId: file.worktreeId,
    worktreePath,
    relativePath: file.relativePath,
    preview: false,
    area: 'branch-worktree'
  })
  latest.closeFile(fileId)
  // Why after the close: the editor shares the diff's file path, so it would take the reveal itself.
  if (line) {
    latest.setPendingEditorReveal({ filePath: file.filePath, line, column: 1, matchLength: 0 })
  }
  return true
}

export function showFileEdit(
  fileId: string,
  line: number | null,
  markdownViewMode?: MarkdownViewMode
): void {
  const state = useAppStore.getState()
  const file = state.openFiles.find((candidate) => candidate.id === fileId)
  if (!file || file.mode !== 'diff') {
    return
  }
  state.openFile({
    filePath: file.filePath,
    relativePath: file.relativePath,
    worktreeId: file.worktreeId,
    runtimeEnvironmentId: file.runtimeEnvironmentId,
    language: detectLanguage(file.relativePath),
    mode: 'edit'
  })
  if (markdownViewMode) {
    state.setEditorViewMode(file.filePath, 'edit')
    state.setMarkdownViewMode(file.filePath, markdownViewMode)
  }
  state.closeFile(fileId)
  if (line) {
    revealLineAfterOpen(file.filePath, line)
  }
}
