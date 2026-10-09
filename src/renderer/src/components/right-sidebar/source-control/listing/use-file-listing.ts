import { useCallback, useEffect, useMemo } from 'react'
import { deriveSourceControlPushRecovery } from '../sync/push-recovery'
import { isSourceControlSplitOpenModifier, type SourceControlRowOpenEvent } from './split-open'
import { useSourceControlSelection } from './use-selection'
import { useSourceControlSubmoduleStatus } from './use-submodule-status'
import type { SourceControlActionError } from '../sync/action-error'
import { useSourceControlBulkActions } from '../commit/use-bulk-actions'
import type { SourceControlPanelViewState } from '../panel/use-panel-view-state'
import { useSourceControlGitHistory } from '../sync/use-git-history'
import type { SourceControlStatusRefresh } from '../sync/use-status-refresh'
import { useSourceControlFileProjection } from './use-file-projection'
import type { SourceControlFileCategory } from './file-category'
import { useSourceControlReviewAttributes } from './use-review-attributes'
import { usePublishedSourceControlReviewOrder } from './use-published-review-order'
import { clearOpenInSelection, setOpenInSelection } from '@/lib/open-in-selection'
import { usePRCommentScope } from '@/components/pr-comments/use-pr-comment-scope'
import { buildUnresolvedThreadCountByPath } from '@/components/pr-comments/unresolved-thread-count'
import { parseChangedFileRowKey } from '@/store/slices/editor/actions/changed-file-order'
import { joinPath } from '@/lib/path'
import { useSourceControlRowOpening } from './use-row-opening'
import type { SourceControlWorktreeContext } from './use-worktree-context'
import { usePendingReviewCountByPath } from '@/components/pending-review/pending-review-count'

/**
 * Projects git status and branch compare into the rows the panel renders, and layers the
 * interactions that operate on those rows: submodule expansion, diff opening, selection, bulk
 * staging and the git history feed.
 */
export function useSourceControlFileListing({
  activeRemoteActionSequence,
  activeRepoSettings,
  activeWorktreeId,
  branchEntries,
  branchName,
  branchSummary,
  collapsedSections,
  collapsedTreeDirs,
  compareBaseRef,
  entries,
  filterQuery,
  hiddenFileCategories,
  isBranchVisible,
  isFolder,
  isGitHistoryExpanded,
  isMac,
  refreshActiveGitStatusAfterMutation,
  remoteActionError,
  repositoryHuge,
  rightSidebarTab,
  sourceControlGroupOrder,
  sourceControlRef,
  sourceControlViewMode,
  worktreeMap,
  worktreePath
}: {
  activeRemoteActionSequence: number | null
  activeRepoSettings: SourceControlWorktreeContext['activeRepoSettings']
  activeWorktreeId: string | null
  branchEntries: SourceControlWorktreeContext['branchEntries']
  branchName: string
  branchSummary: SourceControlWorktreeContext['branchSummary']
  collapsedSections: Set<string>
  collapsedTreeDirs: Set<string>
  compareBaseRef: string | null
  entries: SourceControlWorktreeContext['entries']
  filterQuery: string
  hiddenFileCategories: ReadonlySet<SourceControlFileCategory>
  isBranchVisible: boolean
  isFolder: boolean
  isGitHistoryExpanded: boolean
  isMac: boolean
  refreshActiveGitStatusAfterMutation: SourceControlStatusRefresh['refreshActiveGitStatusAfterMutation']
  remoteActionError: SourceControlActionError | null
  repositoryHuge: SourceControlWorktreeContext['repositoryHuge']
  rightSidebarTab: SourceControlWorktreeContext['rightSidebarTab']
  sourceControlGroupOrder: SourceControlPanelViewState['sourceControlGroupOrder']
  sourceControlRef: SourceControlPanelViewState['sourceControlRef']
  sourceControlViewMode: SourceControlPanelViewState['sourceControlViewMode']
  worktreeMap: SourceControlWorktreeContext['worktreeMap']
  worktreePath: string | null
}) {
  const { expandedSubmoduleKeys, submoduleStatusByKey, toggleSubmodule } =
    useSourceControlSubmoduleStatus({
      activeWorktreeId,
      worktreePath,
      activeRepoSettings,
      entries
    })
  const reviewAttributes = useSourceControlReviewAttributes({
    activeWorktreeId,
    worktreePath,
    activeRepoSettings,
    isFolder,
    entries,
    branchEntries
  })
  const {
    grouped,
    fileFilterState,
    normalizedFilter,
    presentFileCategories,
    isCategoryFilterActive,
    isGitHistoryVisible,
    filteredGrouped,
    displaySections,
    unfilteredDisplaySectionsById,
    filteredBranchEntries,
    visibleTreeRowsBySection,
    visibleListRowsBySection,
    visibleBranchTreeRows,
    visibleSelectionEntries
  } = useSourceControlFileProjection({
    entries,
    branchEntries,
    filterQuery,
    hiddenFileCategories,
    reviewAttributes,
    sourceControlGroupOrder,
    activeWorktreeId,
    worktreePath,
    isFolder,
    collapsedTreeDirs,
    expandedSubmoduleKeys,
    submoduleStatusByKey,
    sourceControlViewMode,
    collapsedSections
  })
  const { gitHistoryState, refreshGitHistory, refreshGitHistoryRef } = useSourceControlGitHistory({
    activeRepoSettings,
    activeWorktreeId,
    worktreePath,
    compareBaseRef,
    isFolder,
    isBranchVisible,
    isGitHistoryExpanded,
    isGitHistoryVisible,
    worktreeMap
  })

  // Why: modifier-click keeps the current pane intact by opening the file in a fresh split to the right.
  const {
    resolveSplitTargetGroupId,
    activeOpenRowKeys,
    activeOpenRowKey,
    handleOpenDiff,
    openCommittedDiff
  } = useSourceControlRowOpening({
    isMac,
    activeWorktreeId,
    worktreePath,
    visibleSelectionEntries,
    branchSummary
  })

  usePublishedSourceControlReviewOrder({
    activeWorktreeId,
    visibleSelectionEntries,
    visibleBranchTreeRows,
    filteredBranchEntries
  })

  const shouldOpenAsSplit = useCallback(
    (event: SourceControlRowOpenEvent) => isSourceControlSplitOpenModifier(event, isMac),
    [isMac]
  )
  const { selectedKeys, handleSelect, handleContextMenu, clearSelection } =
    useSourceControlSelection({
      flatEntries: visibleSelectionEntries,
      onOpenDiff: handleOpenDiff,
      shouldOpenAsSplit,
      containerRef: sourceControlRef
    })

  // clear selection on list/tree presentation change
  useEffect(() => {
    clearSelection()
  }, [sourceControlViewMode, clearSelection])

  // Clear selection on worktree or tab change
  useEffect(() => {
    clearSelection()
  }, [activeWorktreeId, rightSidebarTab, clearSelection])

  const flatEntriesByKey = useMemo(
    () => new Map(visibleSelectionEntries.map((entry) => [entry.key, entry])),
    [visibleSelectionEntries]
  )

  // Why here: this hook already owns what the panel renders, and the map has to be built once for
  // the list rather than per row on every filter keystroke.
  const { groups: prCommentGroups } = usePRCommentScope(activeWorktreeId)
  const reviewThreadCountByPath = useMemo(
    () => buildUnresolvedThreadCountByPath(prCommentGroups),
    [prCommentGroups]
  )
  const pendingReviewCountByPath = usePendingReviewCountByPath(activeWorktreeId)

  // Why the highlighted row rather than the clicked one: stepping with the file-navigation chord
  // moves the highlight without touching the click selection, and the user means whichever row the
  // panel is showing as current -- how they got there is not the point.
  //
  // Why published rather than lifted: the open-in chord reads this once, on a keystroke, and this
  // changes on every step.
  const openInPath = useMemo(() => {
    if (!worktreePath) {
      return null
    }
    const highlighted = activeOpenRowKey
      ? parseChangedFileRowKey(activeOpenRowKey)?.relativePath
      : null
    if (highlighted) {
      return joinPath(worktreePath, highlighted)
    }
    for (const key of selectedKeys) {
      const entry = flatEntriesByKey.get(key)
      if (entry) {
        return joinPath(worktreePath, entry.entry.path)
      }
    }
    return null
  }, [activeOpenRowKey, flatEntriesByKey, selectedKeys, worktreePath])
  useEffect(() => {
    setOpenInSelection('source-control', openInPath)
    return () => clearOpenInSelection('source-control')
  }, [openInPath])
  const {
    isExecutingBulk,
    setIsExecutingBulk,
    bulkStagePaths,
    bulkUnstagePaths,
    selectedKeySet,
    handleBulkStage,
    handleBulkUnstage,
    handleStageAllPaths,
    handleStageSectionPaths,
    handleUnstagePaths,
    handleStageAllPrimary,
    handleStageWorktreeChanges
  } = useSourceControlBulkActions({
    selectedKeys,
    flatEntriesByKey,
    activeRepoSettings,
    activeWorktreeId,
    worktreePath,
    grouped,
    isStatusTruncated: repositoryHuge !== undefined,
    clearSelection,
    refreshActiveGitStatusAfterMutation
  })
  const unresolvedConflicts = useMemo(
    () => entries.filter((entry) => entry.conflictStatus === 'unresolved' && entry.conflictKind),
    [entries]
  )
  const unresolvedConflictReviewEntries = useMemo(
    () =>
      unresolvedConflicts.map((entry) => ({
        path: entry.path,
        conflictKind: entry.conflictKind!
      })),
    [unresolvedConflicts]
  )
  const pushRecovery = useMemo(
    () =>
      deriveSourceControlPushRecovery({
        actionError: remoteActionError,
        currentBranchName: branchName || null,
        currentSequence: activeRemoteActionSequence
      }),
    [activeRemoteActionSequence, branchName, remoteActionError]
  )

  return {
    reviewThreadCountByPath,
    pendingReviewCountByPath,
    activeOpenRowKeys,
    activeOpenRowKey,
    bulkStagePaths,
    bulkUnstagePaths,
    clearSelection,
    displaySections,
    expandedSubmoduleKeys,
    fileFilterState,
    filteredBranchEntries,
    filteredGrouped,
    flatEntriesByKey,
    gitHistoryState,
    grouped,
    handleBulkStage,
    handleBulkUnstage,
    handleContextMenu,
    handleOpenDiff,
    handleSelect,
    handleStageAllPaths,
    handleStageAllPrimary,
    handleStageSectionPaths,
    handleStageWorktreeChanges,
    handleUnstagePaths,
    isExecutingBulk,
    isCategoryFilterActive,
    isGitHistoryVisible,
    normalizedFilter,
    openCommittedDiff,
    presentFileCategories,
    pushRecovery,
    refreshGitHistory,
    refreshGitHistoryRef,
    resolveSplitTargetGroupId,
    selectedKeySet,
    selectedKeys,
    setIsExecutingBulk,
    submoduleStatusByKey,
    toggleSubmodule,
    unfilteredDisplaySectionsById,
    unresolvedConflictReviewEntries,
    unresolvedConflicts,
    visibleBranchTreeRows,
    visibleListRowsBySection,
    visibleSelectionEntries,
    visibleTreeRowsBySection
  }
}

export type SourceControlFileListing = ReturnType<typeof useSourceControlFileListing>
