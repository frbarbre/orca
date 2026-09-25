import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'
import { getSourceControlReviewOrder } from '@/lib/source-control-review-order'
import {
  buildChangedFileOrder,
  parseChangedFileRowKey,
  resolveCurrentRowKey,
  stepChangedFile
} from './changed-file-order'

export function createStepToChangedFile(
  _set: EditorSet,
  get: EditorGet
): Pick<EditorSlice, 'stepToChangedFile'> {
  return {
    // Why: change navigation stops at the file boundary, so a reviewer had to reach for the mouse to
    // reach the next file. Steps the same sequence the source-control panel lists, relative to the
    // file currently open.
    stepToChangedFile: (direction) => {
      const state = get()
      const activeFile = state.openFiles.find((file) => file.id === state.activeFileId)
      const worktreeId = activeFile?.worktreeId ?? state.activeWorktreeId
      if (!worktreeId) {
        return
      }
      const worktreePath = state.getKnownWorktreeById(worktreeId)?.path
      if (!worktreePath) {
        return
      }

      // Why: prefer the order the Source Control panel is showing — it honours the filter, the
      // collapsed directories and the tree grouping, none of which the raw git arrays carry. The
      // fallback keeps stepping usable when the panel has never been mounted.
      const order =
        getSourceControlReviewOrder(worktreeId) ??
        buildChangedFileOrder(
          state.gitStatusByWorktree[worktreeId] ?? [],
          state.gitBranchChangesByWorktree[worktreeId] ?? []
        )
      // Why: only a file from this worktree can locate the cursor in the order; an editor on another
      // worktree enters the list from its start.
      const currentKey =
        activeFile && activeFile.worktreeId === worktreeId
          ? resolveCurrentRowKey(order, activeFile.diffSource, activeFile.relativePath ?? null)
          : null
      const targetKey = stepChangedFile(order, currentKey, direction)
      const target = targetKey ? parseChangedFileRowKey(targetKey) : null
      if (!target) {
        return
      }

      // Why the area travels with the target: a path present in both sections would otherwise
      // always open its working-tree diff, making the branch row impossible to land on.
      state.openDiffAtLocation({
        worktreeId,
        worktreePath,
        relativePath: target.relativePath,
        area: target.area
      })
    }
  }
}
