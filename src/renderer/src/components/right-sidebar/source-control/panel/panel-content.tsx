import { shouldShowSourceControlCompareUnavailableCard } from './header-toolbar'
import { SourceControlBranchSection } from '../listing/branch-section'
import { SourceControlAllChangesSection } from '../listing/all-changes-section'
import { changesFilterBadge, clearChangesFilter } from '@/lib/changes-filter'
import { SourceControlContentStatus } from '../listing/content-status'
import {
  SourceControlFileCategoryFilter,
  shouldShowSourceControlFileCategoryFilter
} from '../listing/file-category-filter'
import { SourceControlUncommittedSections } from '../listing/uncommitted-sections'
import { CompareUnavailable } from '../sync/compare-summary'
import { SourceControlForkPushNotice } from './fork-push-notice'
import type { SourceControlPanelReadyProps } from './panel-props'

/** The Changes section: status, commit affordances and the file sections. */
export function SourceControlPanelContent(props: SourceControlPanelReadyProps) {
  const { activeWorktree, currentWorktreeId, model, worktreePath } = props
  const {
    settings,
    allChangeEntries,
    changesFilter,
    openAllChangesEntry,
    showAllChanges,
    totalAllChangeCount,
    visibleAllChangesTreeRows,
    activeConnectionId,
    activeOpenRowKeys,
    activeOpenRowKey,
    branchEntries,
    branchSummary,
    collapsedSections,
    collapsedTreeDirs,
    conflictOperation,
    diffCommentCountByPath,
    reviewThreadCountByPath,
    pendingReviewCountByPath,
    displaySections,
    expandedSubmoduleKeys,
    fileFilterState,
    fileListScrollElement,
    filterQuery,
    filteredBranchEntries,
    handleAbortOperationForConflict,
    handleContextMenu,
    handleOpenDiff,
    handleResolveConflictsWithAI,
    handleSelect,
    handleStage,
    handleStageAllPaths,
    handleStageSectionPaths,
    handleStageWorktreeChanges,
    handleUnstage,
    handleUnstagePaths,
    hasUncommittedEntries,
    hiddenFileCategories,
    isAbortingOperation,
    isCategoryFilterActive,
    isCheckingRecoveryAdmission,
    isExecutingBulk,
    normalizedFilter,
    openAllDiffs,
    openBranchAllDiffs,
    openCommittedDiff,
    openConflictReview,
    presentFileCategories,
    refreshActiveGitStatus,
    refreshBranchCompare,
    repositoryHuge,
    requestDiscardAllInArea,
    requestDiscardEntry,
    requestDiscardPaths,
    revealInExplorer,
    selectedKeySet,
    setBaseRefDialogOpen,
    sourceControlAiActionsVisible,
    sourceControlViewMode,
    toggleFileCategory,
    toggleSection,
    toggleSubmodule,
    toggleTreeDir,
    unresolvedConflictReviewEntries,
    unfilteredDisplaySectionsById,
    visibleBranchTreeRows,
    visibleListRowsBySection,
    visibleTreeRowsBySection
  } = model

  const hasFilteredUncommittedEntries = displaySections.length > 0
  const hasFilteredBranchEntries = filteredBranchEntries.length > 0
  const showGenericEmptyState =
    !hasUncommittedEntries && branchSummary?.status === 'ready' && branchEntries.length === 0
  const sectionLayout = settings?.sourceControlSectionLayout
  const hiddenSections = sectionLayout?.hidden ?? []
  const changesHidden = hiddenSections.includes('changes')

  return (
    <>
      <SourceControlContentStatus
        unresolvedConflictCount={unresolvedConflictReviewEntries.length}
        conflictOperation={conflictOperation}
        sourceControlAiActionsVisible={sourceControlAiActionsVisible}
        isRecoveryBusy={isCheckingRecoveryAdmission}
        isAbortingOperation={isAbortingOperation}
        onAbortOperation={handleAbortOperationForConflict}
        onResolveWithAi={() => void handleResolveConflictsWithAI()}
        onReviewConflicts={() => {
          openConflictReview(
            currentWorktreeId,
            worktreePath,
            unresolvedConflictReviewEntries,
            'live-summary'
          )
        }}
        repositoryHuge={repositoryHuge}
        worktreeId={currentWorktreeId}
        onRetryStatus={refreshActiveGitStatus}
        onStageAllChanges={handleStageWorktreeChanges}
        isExecutingBulk={isExecutingBulk}
        showGenericEmptyState={showGenericEmptyState}
        normalizedFilter={normalizedFilter}
        branchBaseRef={branchSummary?.baseRef ?? null}
        filterTooLarge={fileFilterState.tooLarge}
        hasFilteredUncommittedEntries={hasFilteredUncommittedEntries}
        hasFilteredBranchEntries={hasFilteredBranchEntries}
        filterQuery={filterQuery}
        isCategoryFilterActive={isCategoryFilterActive}
      />

      <SourceControlForkPushNotice pushTarget={activeWorktree.pushTarget ?? null} />

      {!showAllChanges &&
        shouldShowSourceControlFileCategoryFilter(
          presentFileCategories,
          isCategoryFilterActive
        ) && (
          <SourceControlFileCategoryFilter
            presentFileCategories={presentFileCategories}
            hiddenFileCategories={hiddenFileCategories}
            isCategoryFilterActive={isCategoryFilterActive}
            onToggleFileCategory={toggleFileCategory}
          />
        )}

      {/* Why also when empty under a filter: the filters live in this header, so they must stay reachable. */}
      {showAllChanges &&
        !changesHidden &&
        (allChangeEntries.length > 0 || isCategoryFilterActive || changesFilter) && (
          <SourceControlAllChangesSection
            baseRef={
              branchSummary?.status === 'ready' &&
              (!changesFilter || changesFilter.kind === 'uncommitted')
                ? branchSummary.baseRef
                : null
            }
            entries={allChangeEntries}
            totalEntryCount={totalAllChangeCount}
            collapsed={collapsedSections.has('all-changes')}
            onToggle={() => toggleSection('all-changes')}
            sourceControlViewMode={sourceControlViewMode}
            visibleTreeRows={visibleAllChangesTreeRows}
            fileListScrollElement={fileListScrollElement}
            collapsedTreeDirs={collapsedTreeDirs}
            toggleTreeDir={toggleTreeDir}
            currentWorktreeId={currentWorktreeId}
            worktreePath={worktreePath}
            revealInExplorer={revealInExplorer}
            activeConnectionId={activeConnectionId}
            onOpen={openAllChangesEntry}
            headerActions={
              shouldShowSourceControlFileCategoryFilter(
                presentFileCategories,
                isCategoryFilterActive
              ) ? (
                <SourceControlFileCategoryFilter
                  compact
                  presentFileCategories={presentFileCategories}
                  hiddenFileCategories={hiddenFileCategories}
                  isCategoryFilterActive={isCategoryFilterActive}
                  onToggleFileCategory={toggleFileCategory}
                />
              ) : null
            }
            filterBadge={changesFilterBadge(changesFilter)}
            onClearFilter={() => clearChangesFilter(currentWorktreeId)}
            diffCommentCountByPath={diffCommentCountByPath}
            reviewThreadCountByPath={reviewThreadCountByPath}
            pendingReviewCountByPath={pendingReviewCountByPath}
            activeOpenRowKeys={activeOpenRowKeys}
            activeOpenRowKey={activeOpenRowKey}
          />
        )}

      {hasFilteredUncommittedEntries && !showAllChanges && !changesHidden && (
        <SourceControlUncommittedSections
          displaySections={displaySections}
          unfilteredDisplaySectionsById={unfilteredDisplaySectionsById}
          normalizedFilter={normalizedFilter}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          onViewSection={(sectionViewAction) => {
            if (sectionViewAction.kind === 'conflict-review') {
              openConflictReview(
                currentWorktreeId,
                worktreePath,
                sectionViewAction.entries,
                'live-summary'
              )
            } else {
              openAllDiffs(
                currentWorktreeId,
                worktreePath,
                undefined,
                sectionViewAction.area,
                sectionViewAction.entries
              )
            }
          }}
          isExecutingBulk={isExecutingBulk}
          requestDiscardAllInArea={requestDiscardAllInArea}
          handleStageAllPaths={handleStageAllPaths}
          handleStageSectionPaths={handleStageSectionPaths}
          handleUnstagePaths={handleUnstagePaths}
          sourceControlViewMode={sourceControlViewMode}
          visibleTreeRowsBySection={visibleTreeRowsBySection}
          visibleListRowsBySection={visibleListRowsBySection}
          fileListScrollElement={fileListScrollElement}
          collapsedTreeDirs={collapsedTreeDirs}
          toggleTreeDir={toggleTreeDir}
          requestDiscardPaths={requestDiscardPaths}
          expandedSubmoduleKeys={expandedSubmoduleKeys}
          toggleSubmodule={toggleSubmodule}
          currentWorktreeId={currentWorktreeId}
          worktreePath={worktreePath}
          selectedKeySet={selectedKeySet}
          activeOpenRowKeys={activeOpenRowKeys}
          activeOpenRowKey={activeOpenRowKey}
          handleSelect={handleSelect}
          handleContextMenu={handleContextMenu}
          revealInExplorer={revealInExplorer}
          activeConnectionId={activeConnectionId}
          handleOpenDiff={handleOpenDiff}
          handleStage={handleStage}
          handleUnstage={handleUnstage}
          requestDiscardEntry={requestDiscardEntry}
          diffCommentCountByPath={diffCommentCountByPath}
          reviewThreadCountByPath={reviewThreadCountByPath}
          pendingReviewCountByPath={pendingReviewCountByPath}
        />
      )}

      {shouldShowSourceControlCompareUnavailableCard(
        branchSummary,
        hasUncommittedEntries,
        branchEntries.length > 0,
        Boolean(normalizedFilter)
      ) && branchSummary ? (
        <CompareUnavailable
          summary={branchSummary}
          onChangeBaseRef={() => setBaseRefDialogOpen(true)}
          onRetry={() => void refreshBranchCompare()}
        />
      ) : null}

      {branchSummary?.status === 'ready' &&
        hasFilteredBranchEntries &&
        !showAllChanges &&
        !changesHidden && (
          <SourceControlBranchSection
            activeOpenRowKeys={activeOpenRowKeys}
            activeOpenRowKey={activeOpenRowKey}
            branchSummary={branchSummary}
            filteredBranchEntries={filteredBranchEntries}
            totalBranchEntryCount={branchEntries.length}
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            sourceControlViewMode={sourceControlViewMode}
            visibleBranchTreeRows={visibleBranchTreeRows}
            fileListScrollElement={fileListScrollElement}
            collapsedTreeDirs={collapsedTreeDirs}
            toggleTreeDir={toggleTreeDir}
            currentWorktreeId={currentWorktreeId}
            worktreePath={worktreePath}
            revealInExplorer={revealInExplorer}
            activeConnectionId={activeConnectionId}
            openCommittedDiff={openCommittedDiff}
            openBranchAllDiffs={openBranchAllDiffs}
            diffCommentCountByPath={diffCommentCountByPath}
            reviewThreadCountByPath={reviewThreadCountByPath}
            pendingReviewCountByPath={pendingReviewCountByPath}
          />
        )}
    </>
  )
}
