import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'

export function createOpenDiffAtLocation(
  _set: EditorSet,
  get: EditorGet
): Pick<EditorSlice, 'openDiffAtLocation'> {
  return {
    // Why: route a review location by relative path to whichever diff surface owns it — unstaged,
    // then branch compare, else a plain editor tab. Mirrors the source-control note routing so a
    // hosted PR comment lands on the same surface an Orca note would.
    openDiffAtLocation: ({ worktreeId, worktreePath, relativePath, line, preview = true }) => {
      const state = get()
      const language = detectLanguage(relativePath)
      const filePath = joinPath(worktreePath, relativePath)

      if (line !== undefined) {
        // Why: stamp before the open so the surface reads a reveal that is already armed; a diff
        // surface consumes it on mount, an edit tab on its next render.
        state.setPendingEditorReveal({ filePath, line, column: 1, matchLength: 0 })
      }

      const matches = (state.gitStatusByWorktree[worktreeId] ?? []).filter(
        (entry) => entry.path === relativePath
      )
      const uncommitted =
        matches.find((entry) => entry.area === 'unstaged') ??
        matches.find((entry) => entry.area === 'untracked') ??
        matches[0]
      if (uncommitted) {
        // Why: open as a preview so stepping through a review reuses one tab, the way clicking a
        // source-control row does, instead of stacking a permanent tab per file.
        state.openDiff(
          worktreeId,
          filePath,
          relativePath,
          language,
          uncommitted.area === 'staged',
          {
            preview
          }
        )
        return
      }

      const branchEntry = (state.gitBranchChangesByWorktree[worktreeId] ?? []).find(
        (entry) => entry.path === relativePath
      )
      const branchSummary = state.gitBranchCompareSummaryByWorktree[worktreeId]
      if (branchEntry && branchSummary?.status === 'ready') {
        state.openBranchDiff(worktreeId, worktreePath, branchEntry, branchSummary, language, {
          preview
        })
        return
      }

      // Why: neither diff surface has the file (e.g. the change is committed and merged), so open a
      // plain tab in changes mode — the same fallback the source-control notes shelf uses.
      state.openFile({ filePath, relativePath, worktreeId, language, mode: 'edit' }, { preview })
      state.setEditorViewMode(filePath, 'changes')
    }
  }
}
