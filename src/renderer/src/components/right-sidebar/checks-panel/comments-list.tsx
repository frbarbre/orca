import React, { useMemo, useState } from 'react'
import { LoaderCircle, MessageSquare, Plus, SendHorizontal, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  getPRCommentAudienceEmptyLabel,
  getPrCommentAudienceFilters
} from '@/lib/pr-comment-audience-labels'
import { translate } from '@/i18n/i18n'
import { ResolvedCommentGroupsSection } from './comment-group'
import { PendingReviewPanelSection } from '@/components/pending-review/PendingReviewPanelSection'
import { SectionHeader } from '../source-control/listing/section-header'
import { type PRCommentsListProps, useCommentsListState } from './use-comments-list-state'
import { CommentDisplayModeMenu } from './comment-display-mode-menu'
import { withoutResolvedThreads } from './listed-comments'

export function PRCommentsList(listProps: PRCommentsListProps): React.JSX.Element {
  const listedComments = useMemo(
    () =>
      listProps.sectionHeader ? withoutResolvedThreads(listProps.comments) : listProps.comments,
    [listProps.comments, listProps.sectionHeader]
  )
  const props = { ...listProps, comments: listedComments }
  const {
    comments,
    commentsError,
    commentsLoading,
    reviewKind = 'PR',
    commentsDisabled,
    commentsDisabledReason,
    resolveCommentsWithAIDisabled,
    resolveCommentsWithAIDisabledReason,
    onAddComment,
    onResolveSelectedCommentsWithAI,
    onReply,
    onResolve,
    onEditComment,
    onDeleteComment,
    onSetReaction,
    sectionHeader = false
  } = props
  const {
    presentation,
    commentFilter,
    setCommentFilter,
    displayMode,
    setDisplayMode,
    replyingCommentId,
    setReplyingCommentId,
    isAddingComment,
    botAuthorOverrides,
    commentCounts,
    isSelectingForAI,
    selectableGroups,
    selectedGroups,
    selectedCommentQueueCount,
    clearSelection,
    visibleComments,
    triageGroups,
    timelineGroups,
    canShowResolveWithAI,
    startAddComment,
    renderCommentGroup,
    renderAddCommentComposer,
    now
  } = useCommentsListState(props)
  const [collapsed, setCollapsed] = useState(false)
  const headerActions = (
    <div className="-mr-1 ml-auto flex items-center gap-0.5">
      {canShowResolveWithAI && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                aria-label={translate(
                  'auto.components.right.sidebar.checks.panel.content.d7a2f9c401',
                  'Send unresolved {{value0}} comments',
                  { value0: reviewKind }
                )}
                disabled={commentsLoading || resolveCommentsWithAIDisabled}
                title={
                  resolveCommentsWithAIDisabled ? resolveCommentsWithAIDisabledReason : undefined
                }
                onClick={() => onResolveSelectedCommentsWithAI?.(selectableGroups)}
              >
                <Sparkles className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {resolveCommentsWithAIDisabled && resolveCommentsWithAIDisabledReason
                ? resolveCommentsWithAIDisabledReason
                : translate(
                    'auto.components.right.sidebar.checks.panel.content.d7a2f9c401',
                    'Send unresolved {{value0}} comments',
                    { value0: reviewKind }
                  )}
            </TooltipContent>
          </Tooltip>
          {isSelectingForAI && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    size="icon-xs"
                    className="relative"
                    aria-label={translate(
                      'auto.components.right.sidebar.checks.panel.content.d91f2a6c39',
                      'Send {{value0}} queued comments to AI',
                      { value0: selectedCommentQueueCount }
                    )}
                    disabled={
                      selectedCommentQueueCount === 0 ||
                      commentsLoading ||
                      resolveCommentsWithAIDisabled
                    }
                    title={
                      resolveCommentsWithAIDisabled
                        ? resolveCommentsWithAIDisabledReason
                        : undefined
                    }
                    onClick={() => onResolveSelectedCommentsWithAI?.(selectedGroups)}
                  >
                    <SendHorizontal className="size-3" />
                    <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-background px-0.5 text-[9px] leading-none text-foreground tabular-nums">
                      {selectedCommentQueueCount}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {resolveCommentsWithAIDisabled && resolveCommentsWithAIDisabledReason
                    ? resolveCommentsWithAIDisabledReason
                    : translate(
                        'auto.components.right.sidebar.checks.panel.content.d91f2a6c39',
                        'Send {{value0}} queued comments to AI',
                        { value0: selectedCommentQueueCount }
                      )}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={translate(
                      'auto.components.right.sidebar.checks.panel.content.a6de3e5a20',
                      'Clear queued comments'
                    )}
                    onClick={clearSelection}
                  >
                    <X className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {translate(
                    'auto.components.right.sidebar.checks.panel.content.a6de3e5a20',
                    'Clear queued comments'
                  )}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </>
      )}
      {comments.length > 0 && (
        <CommentDisplayModeMenu displayMode={displayMode} onDisplayModeChange={setDisplayMode} />
      )}
      {onAddComment && !isAddingComment && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={
                comments.length === 0
                  ? translate(
                      'auto.components.right.sidebar.checks.panel.content.7440d09d2c',
                      'Start conversation'
                    )
                  : translate(
                      'auto.components.right.sidebar.checks.panel.content.2b2be92919',
                      'Add comment'
                    )
              }
              disabled={commentsDisabled}
              title={commentsDisabled ? commentsDisabledReason : undefined}
              className="text-muted-foreground hover:text-foreground"
              onClick={startAddComment}
            >
              <Plus className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {commentsDisabled && commentsDisabledReason
              ? commentsDisabledReason
              : comments.length === 0
                ? translate(
                    'auto.components.right.sidebar.checks.panel.content.7440d09d2c',
                    'Start conversation'
                  )
                : translate(
                    'auto.components.right.sidebar.checks.panel.content.2b2be92919',
                    'Add comment'
                  )}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
  // Fork: in the PR panel the list is a section, headed by the shared section header (which is
  // also its drag handle and Hide menu) with the comment actions in it.
  const section = sectionHeader ? (
    <SectionHeader
      label={translate('prPanelSections.comments', 'Comments')}
      count={comments.length}
      isCollapsed={collapsed}
      onToggle={() => setCollapsed((prev) => !prev)}
      actions={headerActions}
    />
  ) : null
  if (sectionHeader && collapsed) {
    return <div>{section}</div>
  }
  return (
    <div className={sectionHeader ? undefined : 'border-t border-border'}>
      {section}
      {/* Header */}
      {sectionHeader && comments.length === 0 ? null : (
        <div
          className={cn(
            presentation.sectionHeader,
            // Why: the checks sidebar scrolls as one column; pinning this header keeps
            // filter and add-comment actions reachable while reading long threads.
            !sectionHeader && 'sticky top-0 z-10 bg-sidebar/95 backdrop-blur-sm',
            // Fork: under a section header the tabs lead straight into the cards, no rule between.
            sectionHeader && 'border-b-0'
          )}
        >
          {!sectionHeader && (
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="size-3.5 text-muted-foreground" />
              <span className={presentation.sectionHeaderLabel}>
                {translate(
                  'auto.components.right.sidebar.checks.panel.content.94557d68e2',
                  'Comments'
                )}
              </span>
              {comments.length > 0 && (
                <span className={presentation.sectionCount}>{comments.length}</span>
              )}
              {headerActions}
            </div>
          )}
          {comments.length > 0 && (
            <div className={presentation.audienceTabs}>
              {getPrCommentAudienceFilters().map((filter) => {
                const isActive = commentFilter === filter.value
                return (
                  <button
                    key={filter.value}
                    type="button"
                    className={cn(
                      presentation.audienceTab,
                      isActive && presentation.audienceTabActive
                    )}
                    aria-pressed={isActive}
                    onClick={() => setCommentFilter(filter.value)}
                  >
                    <span>{filter.label}</span>
                    <span className="tabular-nums">{commentCounts[filter.value]}</span>
                  </button>
                )
              })}
            </div>
          )}
          {comments.length >= 100 && (
            <div className="mt-1.5 text-[10px] text-muted-foreground">
              {translate(
                'auto.components.right.sidebar.checks.panel.content.751f7c6e5c',
                'Showing first 100 comments per source'
              )}
            </div>
          )}
        </div>
      )}

      {/* Fork: in the PR panel, pending review is a section of its own. */}
      {sectionHeader ? null : <PendingReviewPanelSection />}

      {commentsLoading && comments.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 && commentsError ? (
        <div role="alert" className="px-3 py-5 text-[11px] break-words text-destructive">
          {commentsError}
        </div>
      ) : comments.length === 0 && isAddingComment && onAddComment ? (
        renderAddCommentComposer(true)
      ) : comments.length === 0 ? (
        !onAddComment && (
          <div className="flex items-center justify-center py-5 text-[11px] text-muted-foreground">
            {translate(
              'auto.components.right.sidebar.checks.panel.content.755be805f6',
              'No comments'
            )}
          </div>
        )
      ) : visibleComments.length === 0 ? (
        <div className="flex items-center justify-center py-5 text-[11px] text-muted-foreground">
          {getPRCommentAudienceEmptyLabel(commentFilter)}
        </div>
      ) : (
        <div className={presentation.list}>
          {displayMode === 'timeline' ? (
            timelineGroups.map(renderCommentGroup)
          ) : (
            <>
              {triageGroups.open.map(renderCommentGroup)}
              {triageGroups.conversation.map(renderCommentGroup)}
              {/* Fork: in the PR panel, resolved threads are a section of their own. */}
              <ResolvedCommentGroupsSection
                groups={sectionHeader ? [] : triageGroups.resolved}
                botAuthorOverrides={botAuthorOverrides}
                replyingCommentId={replyingCommentId}
                now={now}
                replyDisabled={commentsDisabled}
                replyDisabledReason={commentsDisabledReason}
                presentation={presentation}
                onResolve={onResolve}
                onStartReply={setReplyingCommentId}
                onCancelReply={(commentId) =>
                  setReplyingCommentId((current) => (current === commentId ? null : current))
                }
                onReply={onReply}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
                onSetReaction={onSetReaction}
              />
            </>
          )}
        </div>
      )}
      {onAddComment && comments.length > 0 && isAddingComment && renderAddCommentComposer(false)}
    </div>
  )
}
