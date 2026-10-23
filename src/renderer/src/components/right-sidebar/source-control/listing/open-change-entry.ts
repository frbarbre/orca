import { openWorkspaceFile } from '@/lib/workspace-file-open'
import { detectLanguage } from '@/lib/language-detect'
import { useAppStore } from '@/store'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { openChangesFilterEntry } from '@/store/slices/editor/actions/open-changes-filter-entry'
import { getChangesFilter } from '@/lib/changes-filter'
import { pickUncommittedRowEntry } from './open-diff-follows-filter'

export function openSourceControlChangeEntry({
  worktreeId,
  worktreePath,
  entry,
  statusEntries,
  branchSummary,
  targetGroupId,
  preview
}: {
  worktreeId: string
  worktreePath: string
  entry: GitBranchChangeEntry
  statusEntries: readonly GitStatusEntry[]
  branchSummary: GitBranchCompareSummary | null | undefined
  targetGroupId?: string
  preview?: boolean
}): void {
  const state = useAppStore.getState()
  const language = detectLanguage(entry.path)
  if (
    openChangesFilterEntry(state, worktreeId, worktreePath, entry.path, language, {
      targetGroupId,
      preview
    })
  ) {
    return
  }
  const local = statusEntries.filter((candidate) => candidate.path === entry.path)
  // Why: a conflicted file opens its resolver, and with no base to compare against the plain
  // uncommitted diff is the closest view. Showing only uncommitted work opens that work too.
  const fallback =
    local.find((candidate) => candidate.conflictKind && candidate.conflictStatus) ??
    (getChangesFilter(worktreeId)?.kind === 'uncommitted'
      ? pickUncommittedRowEntry(local)
      : undefined) ??
    (branchSummary?.status === 'ready' ? undefined : local[0])
  if (fallback) {
    openWorkspaceFile({
      kind: 'uncommitted',
      worktreeId,
      worktreePath,
      entry: fallback,
      options: { targetGroupId, preview }
    })
    return
  }
  if (branchSummary?.status !== 'ready') {
    return
  }
  state.openBranchWorktreeDiff(worktreeId, worktreePath, entry, branchSummary, language, {
    targetGroupId,
    preview
  })
}
