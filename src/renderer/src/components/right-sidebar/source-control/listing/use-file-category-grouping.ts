import { useMemo } from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'
import { filterSourceControlPathEntries, type SourceControlFileFilterState } from './file-filter'
import {
  collectSourceControlFileCategories,
  filterSourceControlPathEntriesByCategory,
  type SourceControlFileCategory
} from './file-category'
import type { SourceControlEntryGroups } from '../../../../../../shared/source-control-section-order'

export function useSourceControlCategoryGrouping({
  entries,
  branchEntries,
  grouped,
  hiddenFileCategories,
  reviewAttributes
}: {
  entries: GitStatusEntry[]
  branchEntries: GitBranchChangeEntry[]
  grouped: SourceControlEntryGroups
  hiddenFileCategories: ReadonlySet<SourceControlFileCategory>
  reviewAttributes: GitPathReviewAttributes
}): {
  presentFileCategories: SourceControlFileCategory[]
  isCategoryFilterActive: boolean
  categoryGrouped: SourceControlEntryGroups
} {
  const presentFileCategories = useMemo(
    () => collectSourceControlFileCategories([entries, branchEntries], reviewAttributes),
    [branchEntries, entries, reviewAttributes]
  )
  // Why: a hidden category that is absent from this diff narrows nothing, so it must not read as an active filter.
  const isCategoryFilterActive = presentFileCategories.some((category) =>
    hiddenFileCategories.has(category)
  )
  const categoryGrouped = useMemo((): SourceControlEntryGroups => {
    if (!isCategoryFilterActive) {
      return grouped
    }
    const narrow = (items: GitStatusEntry[]): GitStatusEntry[] =>
      filterSourceControlPathEntriesByCategory(items, hiddenFileCategories, reviewAttributes)
    return {
      staged: narrow(grouped.staged),
      unstaged: narrow(grouped.unstaged),
      untracked: narrow(grouped.untracked)
    }
  }, [grouped, hiddenFileCategories, isCategoryFilterActive, reviewAttributes])
  return { presentFileCategories, isCategoryFilterActive, categoryGrouped }
}

export function filterSourceControlEntryGroups(
  groups: SourceControlEntryGroups,
  fileFilterState: SourceControlFileFilterState
): SourceControlEntryGroups {
  return {
    staged: filterSourceControlPathEntries(groups.staged, fileFilterState),
    unstaged: filterSourceControlPathEntries(groups.unstaged, fileFilterState),
    untracked: filterSourceControlPathEntries(groups.untracked, fileFilterState)
  }
}
