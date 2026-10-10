import { BulkActionBar } from '../commit/bulk-action-bar'
import { SourceControlHeaderToolbar } from './header-toolbar'
import { SourceControlPendingReviewShelf } from '../pending-review/pending-review-shelf'
import { AgentNotesShelf } from '../notes/agent-notes-shelf'
import { useWorktreeAgentNotes } from '@/lib/agent-notes'
import { usePendingReviewQueue } from '@/components/pending-review/use-pending-review-queue'
import { useSubmitReviewVerdict } from '@/components/pending-review/use-submit-review-verdict'
import { SourceControlPanelContent } from './panel-content'
import { SourceControlResizableSections, type ResizableShelf } from './resizable-sections'
import { SourceControlPanelDialogs } from './panel-dialogs'
import type { SourceControlPanelReadyProps } from './panel-props'

/** The panel chrome: toolbar, review and agent-notes shelves, the file surface, bulk bar and dialogs. */
export function SourceControlPanelReady(props: SourceControlPanelReadyProps) {
  const { model, worktreePath } = props
  const pendingReviewQueue = usePendingReviewQueue(props.model.activeWorktreeId ?? null)
  const submitReviewVerdict = useSubmitReviewVerdict(
    props.model.activeWorktreeId ?? null,
    pendingReviewQueue
  )
  const {
    activeWorktreeId,
    branchLineTotal,
    branchSummary,
    bulkStagePaths,
    bulkUnstagePaths,
    clearSelection,
    compareBaseRef,
    filterExpanded,
    filterQuery,
    gitIdentityDisplay,
    handleBulkStage,
    handleBulkUnstage,
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
    setFileListScrollElement,
    setFilterExpanded,
    setFilterQuery,
    setSourceControlRoot,
    settings,
    sourceControlViewMode,
    suppressedGitHubPRState,
    visibleCreatePrHeaderAction
  } = model

  const agentNoteCount = useWorktreeAgentNotes(activeWorktreeId).length

  // Fork: your own notes live in the diff viewer only; agent notes keep a section here.
  const shelves: ResizableShelf[] = []
  // Why not gated on drafts: a verdict stands on its own — an approve needs no comments.
  if (submitReviewVerdict.prNumber !== null) {
    shelves.push({
      id: 'pending-review',
      node: (
        <SourceControlPendingReviewShelf
          queue={pendingReviewQueue}
          submitter={submitReviewVerdict}
          worktreeId={props.model.activeWorktreeId ?? null}
        />
      )
    })
  }
  if (activeWorktreeId && worktreePath && agentNoteCount > 0) {
    shelves.push({
      id: 'agent-notes',
      node: <AgentNotesShelf worktreeId={activeWorktreeId} onOpenNote={handleOpenComment} />
    })
  }

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
          branchSummary={branchSummary}
          branchLineTotal={branchLineTotal}
          compareBaseRef={compareBaseRef}
          headDisplay={gitIdentityDisplay}
          manualReviewUrl={manualReviewUrl}
        />

        <SourceControlResizableSections shelves={shelves}>
          <div
            ref={setFileListScrollElement}
            // Why scroll-pb-9: the Commits header is sticky to the bottom of this scroller, so a row
            // scrolled flush to the bottom edge lands underneath it. Reserving its height keeps a
            // revealed row clear of it, for scrollIntoView and for the virtualizer's own scrolling.
            className="relative flex flex-1 flex-col overflow-auto scrollbar-sleek scroll-pb-9"
            style={{ paddingBottom: selectedKeys.size > 0 ? 50 : undefined }}
          >
            <SourceControlPanelContent {...props} />
          </div>
        </SourceControlResizableSections>

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
