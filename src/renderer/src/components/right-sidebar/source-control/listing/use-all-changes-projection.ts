import { useMemo } from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { useAppStore } from '@/store'
import type { SourceControlViewMode } from '../../../../../../shared/ui-chrome-types'
import {
  buildSourceControlTree,
  compactSourceControlTree,
  flattenSourceControlTree
} from '../../source-control-tree'
import { ALL_CHANGES_AREA, buildAllChangeEntries } from './all-changes'
import type { AllChangesTreeNode } from './all-changes-section'
import type { SourceControlEntryGroups } from './section-order'
import type { FlatEntry } from './use-selection'
import { useChangesFilter } from '@/lib/changes-filter'
import { compareFileNames } from '../../../../../../shared/file-name-sort'

const NO_ENTRIES: GitBranchChangeEntry[] = []
const NO_TREE_ROWS: AllChangesTreeNode[] = []
const NO_SELECTABLE_ENTRIES: FlatEntry[] = []

/** The all-changes rows, built from the same filtered status and branch entries the sections use. */
export function useAllChangesProjection({
  activeWorktreeId,
  sourceControlGrouping,
  visibleSelectionEntries,
  entries,
  branchEntries,
  filteredGrouped,
  filteredBranchEntries,
  sourceControlViewMode,
  collapsedTreeDirs
}: {
  activeWorktreeId: string | null
  sourceControlGrouping: 'all' | 'status'
  visibleSelectionEntries: FlatEntry[]
  entries: readonly GitStatusEntry[]
  branchEntries: readonly GitBranchChangeEntry[]
  filteredGrouped: SourceControlEntryGroups
  filteredBranchEntries: readonly GitBranchChangeEntry[]
  sourceControlViewMode: SourceControlViewMode
  collapsedTreeDirs: ReadonlySet<string>
}) {
  const enabled = sourceControlGrouping === 'all'
  // Why the merge-base check: a total can outlive the fork point it measured, like the branch chip's.
  const lineCounts = useAppStore((s) => {
    const total = activeWorktreeId ? s.gitBranchLineTotalByWorktree?.[activeWorktreeId] : undefined
    return total &&
      activeWorktreeId &&
      total.mergeBase === s.gitBranchCompareSummaryByWorktree[activeWorktreeId]?.mergeBase
      ? total.files
      : undefined
  })
  const changesFilter = useChangesFilter(activeWorktreeId)
  const uncommittedOnly = changesFilter?.kind === 'uncommitted'
  // Fork: a previewed turn or commit lists its own files in place of the branch's.
  const sourceEntries =
    changesFilter && changesFilter.kind !== 'uncommitted' ? changesFilter.entries : null
  const allChangeEntries = useMemo(() => {
    if (!enabled) {
      return NO_ENTRIES
    }
    if (sourceEntries) {
      return [...sourceEntries].sort((a, b) => compareFileNames(a.path, b.path))
    }
    return buildAllChangeEntries(
      [...filteredGrouped.staged, ...filteredGrouped.unstaged, ...filteredGrouped.untracked],
      filteredBranchEntries,
      { uncommittedOnly, ...(lineCounts ? { lineCounts } : {}) }
    )
  }, [enabled, filteredBranchEntries, filteredGrouped, lineCounts, sourceEntries, uncommittedOnly])
  const totalAllChangeCount = useMemo(() => {
    if (!enabled) {
      return 0
    }
    return sourceEntries
      ? sourceEntries.length
      : buildAllChangeEntries(entries, branchEntries).length
  }, [branchEntries, enabled, entries, sourceEntries])
  const visibleAllChangesTreeRows = useMemo(
    () =>
      enabled && sourceControlViewMode === 'tree'
        ? flattenSourceControlTree(
            compactSourceControlTree(buildSourceControlTree(ALL_CHANGES_AREA, allChangeEntries)),
            collapsedTreeDirs
          )
        : NO_TREE_ROWS,
    [allChangeEntries, collapsedTreeDirs, enabled, sourceControlViewMode]
  )
  const allChangesReviewOrder = useMemo(
    () =>
      sourceControlViewMode === 'tree'
        ? visibleAllChangesTreeRows.flatMap((node) => (node.type === 'file' ? [node.key] : []))
        : allChangeEntries.map((entry) => `${ALL_CHANGES_AREA}::${entry.path}`),
    [allChangeEntries, sourceControlViewMode, visibleAllChangesTreeRows]
  )
  return {
    showAllChanges: enabled,
    // Why: the all-changes rows have no staging, so nothing is selectable while they show.
    selectableEntries: enabled ? NO_SELECTABLE_ENTRIES : visibleSelectionEntries,
    changesFilter,
    allChangeEntries,
    totalAllChangeCount,
    visibleAllChangesTreeRows,
    allChangesReviewOrder
  }
}
