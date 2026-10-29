import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'
import { compareFileNames } from '../../../../../../shared/file-name-sort'
import type { ChangesFilter } from '@/lib/changes-filter'
import type { AppState } from '@/store/types'
import { buildAllChangeEntries } from './all-changes'
import {
  filterSourceControlPathEntriesByCategory,
  type SourceControlFileFilterKey
} from './file-category'

// Why the merge-base check: a total can outlive the fork point it measured, like the branch chip's.
export function selectBranchLineCounts(
  state: Pick<AppState, 'gitBranchLineTotalByWorktree' | 'gitBranchCompareSummaryByWorktree'>,
  worktreeId: string | null
): Readonly<Record<string, { added?: number; removed?: number }>> | undefined {
  const total = worktreeId ? state.gitBranchLineTotalByWorktree?.[worktreeId] : undefined
  return total &&
    worktreeId &&
    total.mergeBase === state.gitBranchCompareSummaryByWorktree[worktreeId]?.mergeBase
    ? total.files
    : undefined
}

// Fork: shared by the Changes list and quick open so a file reads the same in both.
export function buildScopedChangeEntries({
  statusEntries,
  branchEntries,
  changesFilter,
  lineCounts,
  hiddenCategories,
  reviewAttributes
}: {
  statusEntries: readonly GitStatusEntry[]
  branchEntries: readonly GitBranchChangeEntry[]
  changesFilter: ChangesFilter | null
  lineCounts?: Readonly<Record<string, { added?: number; removed?: number }>>
  hiddenCategories: ReadonlySet<SourceControlFileFilterKey>
  reviewAttributes: GitPathReviewAttributes
}): GitBranchChangeEntry[] {
  // Fork: a previewed turn or commit lists its own files in place of the branch's.
  if (changesFilter && changesFilter.kind !== 'uncommitted') {
    return [...changesFilter.entries].sort((a, b) => compareFileNames(a.path, b.path))
  }
  return buildAllChangeEntries(
    filterSourceControlPathEntriesByCategory(
      [...statusEntries],
      hiddenCategories,
      reviewAttributes
    ),
    filterSourceControlPathEntriesByCategory(
      [...branchEntries],
      hiddenCategories,
      reviewAttributes
    ),
    {
      uncommittedOnly: changesFilter?.kind === 'uncommitted',
      ...(lineCounts ? { lineCounts } : {})
    }
  )
}
