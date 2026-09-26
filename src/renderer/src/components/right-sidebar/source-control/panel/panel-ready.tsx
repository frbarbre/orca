import { BulkActionBar } from '../commit/bulk-action-bar'
import { SourceControlHeaderToolbar } from './header-toolbar'
import { SourceControlNotesShelf } from '../notes/notes-shelf'
import { SourceControlPendingReviewShelf } from '../pending-review/pending-review-shelf'
import { usePendingReviewQueue } from '@/components/pending-review/use-pending-review-queue'
import { useSubmitReviewVerdict } from '@/components/pending-review/use-submit-review-verdict'
import { SourceControlPanelContent } from './panel-content'
import { SourceControlPanelDialogs } from './panel-dialogs'
import type { SourceControlPanelReadyProps } from './panel-props'

/** The panel chrome: toolbar, notes shelf, the scrolling file surface, bulk bar and dialog layer. */
export function SourceControlPanelReady(props: SourceControlPanelReadyProps) {
  const { model, worktreePath } = props
  const pendingReviewQueue = usePendingReviewQueue(props.model.activeWorktreeId ?? null)
  const submitReviewVerdict = useSubmitReviewVerdict(
    props.model.activeWorktreeId ?? null,
    pendingReviewQueue
  )
  const {
    activeGroupId,
    activeWorktreeId,
    branchLineTotal,
    branchSummary,
    bulkStagePaths,
    bulkUnstagePaths,
    clearSelection,
    compareBaseRef,
    deleteDiffComment,
    diffCommentCount,
    diffCommentsCopied,
    diffCommentsExpanded,
    diffCommentsForActive,
    filterExpanded,
    filterQuery,
    gitIdentityDisplay,
    handleBulkStage,
    handleBulkUnstage,
    handleCopyDiffComments,
    handleCreatePrHeaderClick,
    handleOpenComment,
    handleRelinkSuppressedGitHubPR,
    handleSourceControlKeyDown,
    handleToggleSourceControlViewMode,
    hostedReview,
    isCreatePrIntentInFlight,
    isCreatingPr,
    isExecutingBulk,
    manualReviewUrl,
    openHostedReviewInChecks,
    prGenerating,
    refreshBranchCompare,
    selectedKeys,
    setBaseRefDialogOpen,
    setDiffCommentsExpanded,
    setFileListScrollElement,
    setFilterExpanded,
    setFilterQuery,
    setPendingDiffCommentsClear,
    setSourceControlRoot,
    settings,
    sourceControlViewMode,
    suppressedGitHubPRState,
    visibleCreatePrHeaderAction
  } = model

  return (
    <>
      <div
        ref={setSourceControlRoot}
        className="relative flex h-full flex-col overflow-hidden"
        onKeyDown={handleSourceControlKeyDown}
      >
        <SourceControlHeaderToolbar
          filterQuery={filterQuery}
          filterExpanded={filterExpanded}
          onFilterQueryChange={setFilterQuery}
          onFilterExpandedChange={setFilterExpanded}
          visibleCreatePrHeaderAction={visibleCreatePrHeaderAction}
          hostedReview={hostedReview}
          isCreatePrIntentInFlight={isCreatePrIntentInFlight}
          isCreatingPr={isCreatingPr || prGenerating}
          onCreatePrHeaderClick={handleCreatePrHeaderClick}
          onOpenHostedReviewInChecks={openHostedReviewInChecks}
          suppressedGitHubPRNumber={
            suppressedGitHubPRState?.status === 'matched' ? suppressedGitHubPRState.number : null
          }
          onRelinkSuppressedGitHubPR={handleRelinkSuppressedGitHubPR}
          sourceControlViewMode={sourceControlViewMode}
          viewModeToggleDisabled={settings === null}
          onToggleViewMode={handleToggleSourceControlViewMode}
          onChangeBaseRef={() => setBaseRefDialogOpen(true)}
          onRefreshBranchCompare={() => void refreshBranchCompare()}
          branchCompareRefreshDisabled={!branchSummary || branchSummary.status === 'loading'}
          diffCommentCount={diffCommentCount}
          onExpandNotes={() => setDiffCommentsExpanded(true)}
          branchSummary={branchSummary}
          branchLineTotal={branchLineTotal}
          compareBaseRef={compareBaseRef}
          headDisplay={gitIdentityDisplay}
          manualReviewUrl={manualReviewUrl}
        />

        {/* Why: hidden when empty — a review is queued from the diff view, so an empty shelf is pure chrome. */}
        {pendingReviewQueue.comments.length > 0 && (
          <SourceControlPendingReviewShelf
            queue={pendingReviewQueue}
            onSubmit={submitReviewVerdict}
          />
        )}

        {/* Why: hidden when count is 0 — notes are created from the diff view, so an empty Notes shelf here is pure chrome. */}
        {activeWorktreeId && worktreePath && diffCommentCount > 0 && (
          <SourceControlNotesShelf
            activeWorktreeId={activeWorktreeId}
            activeGroupId={activeGroupId}
            diffCommentsForActive={diffCommentsForActive}
            diffCommentCount={diffCommentCount}
            diffCommentsExpanded={diffCommentsExpanded}
            setDiffCommentsExpanded={setDiffCommentsExpanded}
            diffCommentsCopied={diffCommentsCopied}
            handleCopyDiffComments={handleCopyDiffComments}
            setPendingDiffCommentsClear={setPendingDiffCommentsClear}
            deleteDiffComment={deleteDiffComment}
            handleOpenComment={handleOpenComment}
          />
        )}

        <div
          ref={setFileListScrollElement}
          // Why scroll-pb-9: the Commits header is sticky to the bottom of this scroller, so a row
          // scrolled flush to the bottom edge lands underneath it. Reserving its height keeps a
          // revealed row clear of it, for scrollIntoView and for the virtualizer's own scrolling.
          className="relative flex flex-1 flex-col overflow-auto scrollbar-sleek pt-1 scroll-pb-9"
          style={{ paddingBottom: selectedKeys.size > 0 ? 50 : undefined }}
        >
          <SourceControlPanelContent {...props} />
        </div>

        {selectedKeys.size > 0 && (
          <BulkActionBar
            selectedCount={selectedKeys.size}
            stageableCount={bulkStagePaths.length}
            unstageableCount={bulkUnstagePaths.length}
            onStage={handleBulkStage}
            onUnstage={handleBulkUnstage}
            onClear={clearSelection}
            isExecuting={isExecutingBulk}
          />
        )}
      </div>

      <SourceControlPanelDialogs {...props} />
    </>
  )
}
