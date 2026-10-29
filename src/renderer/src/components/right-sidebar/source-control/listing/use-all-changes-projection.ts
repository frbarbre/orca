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
import { ALL_CHANGES_AREA, buildAllChangeEntries, discardableEntriesByPath } from './all-changes'
import type { AllChangesTreeNode } from './all-changes-section'
import type { SourceControlEntryGroups } from '../../../../../../shared/source-control-section-order'
import type { FlatEntry } from './use-selection'
import { useChangesFilter } from '@/lib/changes-filter'
import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'
import type { SourceControlFileCategory } from './file-category'
import { buildScopedChangeEntries, selectBranchLineCounts } from './scoped-change-entries'

const NO_ENTRIES: GitBranchChangeEntry[] = []
const NO_HIDDEN_CATEGORIES: ReadonlySet<SourceControlFileCategory> = new Set()
const NO_REVIEW_ATTRIBUTES: GitPathReviewAttributes = Object.freeze({})
const NO_TREE_ROWS: AllChangesTreeNode[] = []
const NO_SELECTABLE_ENTRIES: FlatEntry[] = []
const NO_DISCARDABLE: ReadonlyMap<string, GitStatusEntry> = new Map()

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
  const lineCounts = useAppStore((s) => selectBranchLineCounts(s, activeWorktreeId))
  const changesFilter = useChangesFilter(activeWorktreeId)
  const sourceEntries =
    changesFilter && changesFilter.kind !== 'uncommitted' ? changesFilter.entries : null
  const allChangeEntries = useMemo(
    () =>
      enabled
        ? buildScopedChangeEntries({
            statusEntries: [
              ...filteredGrouped.staged,
              ...filteredGrouped.unstaged,
              ...filteredGrouped.untracked
            ],
            branchEntries: filteredBranchEntries,
            changesFilter,
            lineCounts,
            // Why none: the grouped and branch lists arrive already filtered by category.
            hiddenCategories: NO_HIDDEN_CATEGORIES,
            reviewAttributes: NO_REVIEW_ATTRIBUTES
          })
        : NO_ENTRIES,
    [changesFilter, enabled, filteredBranchEntries, filteredGrouped, lineCounts]
  )
  // Why none under a turn or commit: those rows show that change, not what is on disk now.
  const discardableByPath = useMemo(
    () => (enabled && !sourceEntries ? discardableEntriesByPath(entries) : NO_DISCARDABLE),
    [enabled, entries, sourceEntries]
  )
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
    allChangesReviewOrder,
    discardableByPath
  }
}
