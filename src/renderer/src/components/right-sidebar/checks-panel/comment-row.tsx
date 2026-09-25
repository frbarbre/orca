import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { CommentReactions } from '@/components/github/CommentReactions'
import { isBotPRComment } from '../../../../../shared/pr-comment-audience'
import type { GitHubReactionContent, PRComment } from '../../../../../shared/github/comment-types'
import type { PRCommentGroupActionState } from '@/lib/pr-comment-action-state'
import type { PRCommentPresentationClasses } from '../pr-comment-presentation'
import { formatPrCommentRelativeTime } from '../../../../../shared/pr-comment-time'
import { translate } from '@/i18n/i18n'
import {
  buildCopyText,
  CommentMoreMenu,
  CopyButton,
  isMutablePRConversationComment,
  PRCommentActionBadge,
  QueueForAgentButton,
  ResolveButton,
  formatLineRange
} from './comment-controls'

/** A single comment row — used for both root and reply comments. */
export function CommentRow({
  comment,
  botAuthorOverrides,
  isReply,
  showResolve,
  showReply,
  selectionControl,
  actionState,
  isQueued,
  replyDisabled,
  replyDisabledReason,
  presentation,
  now,
  onResolve,
  onReply,
  onEditComment,
  onDeleteComment,
  onSetReaction,
  onQueueForAgent,
  onOpenLocation
}: {
  comment: PRComment
  botAuthorOverrides: ReadonlySet<string>
  isReply: boolean
  showResolve: boolean
  showReply?: boolean
  selectionControl?: React.ReactNode
  actionState: PRCommentGroupActionState
  isQueued: boolean
  replyDisabled?: boolean
  replyDisabledReason?: string
  presentation: PRCommentPresentationClasses
  now: number
  onResolve?: (threadId: string, resolve: boolean) => boolean | Promise<boolean>
  onReply?: (comment: PRComment) => void
  onEditComment?: (comment: PRComment, body: string) => Promise<boolean>
  onDeleteComment?: (comment: PRComment) => void | Promise<void>
  onSetReaction?: (
    comment: PRComment,
    content: GitHubReactionContent,
    reacted: boolean
  ) => Promise<boolean>
  onQueueForAgent?: () => void
  onOpenLocation?: (comment: PRComment) => void
}): React.JSX.Element {
  const automated = isBotPRComment(comment, botAuthorOverrides)
  const canMutateComment = isMutablePRConversationComment(comment)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [submittingEdit, setSubmittingEdit] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(comment.body)
    }
  }, [comment.body, editing])

  // Why: the badge is the only place a review location is shown, so it doubles as the jump target
  // when a handler is wired; without one it stays inert text (mobile and read-only surfaces).
  const canOpenLocation = Boolean(comment.path && onOpenLocation)
  const lineRange = formatLineRange(comment)
  const pathBadgeLabel = comment.path ? (
    presentation.pathBadgeShowsFile ? (
      <>
        {comment.path.split('/').pop()}
        {lineRange && `:${lineRange}`}
      </>
    ) : (
      lineRange
    )
  ) : null
  const pathBadge = comment.path ? (
    canOpenLocation ? (
      <button
        type="button"
        className={cn(presentation.pathBadge, 'cursor-pointer hover:underline')}
        title={comment.path}
        onClick={(event) => {
          event.stopPropagation()
          onOpenLocation?.(comment)
        }}
      >
        {pathBadgeLabel}
      </button>
    ) : (
      <span className={presentation.pathBadge} title={comment.path}>
        {pathBadgeLabel}
      </span>
    )
  ) : null

  const handleStartEdit = useCallback((): void => {
    setDraft(comment.body)
    setEditing(true)
  }, [comment.body])

  const handleCancelEdit = useCallback(
    (event: React.MouseEvent): void => {
      event.stopPropagation()
      setEditing(false)
      setDraft(comment.body)
    },
    [comment.body]
  )

  const handleSaveEdit = useCallback(
    async (event: React.MouseEvent): Promise<void> => {
      event.stopPropagation()
      const trimmedDraft = draft.trim()
      if (!onEditComment || !trimmedDraft || trimmedDraft === comment.body) {
        setEditing(false)
        return
      }
      setSubmittingEdit(true)
      try {
        const ok = await onEditComment(comment, trimmedDraft)
        if (ok) {
          setEditing(false)
        }
      } finally {
        setSubmittingEdit(false)
      }
    },
    [comment, draft, onEditComment]
  )

  const handleDelete = useCallback((): void => {
    void onDeleteComment?.(comment)
  }, [comment, onDeleteComment])

  const trimmedDraft = draft.trim()
  const canSaveEdit = !submittingEdit && trimmedDraft.length > 0 && trimmedDraft !== comment.body
  const relativeTime = formatPrCommentRelativeTime(comment.createdAt, now)

  const authorAvatar = comment.authorAvatarUrl ? (
    <img
      src={comment.authorAvatarUrl}
      alt={comment.author}
      className={cn(isReply ? presentation.avatarReply : presentation.avatar)}
    />
  ) : (
    <div className={cn(isReply ? presentation.avatarReply : presentation.avatar)} aria-hidden />
  )

  const authorName = (
    <span className={cn(presentation.author, comment.isResolved && presentation.authorResolved)}>
      {comment.author}
    </span>
  )
  const queueButton =
    !isReply && onQueueForAgent ? <QueueForAgentButton onQueueForAgent={onQueueForAgent} /> : null

  const hoverActions = !editing ? (
    <div className="flex items-center gap-0.5 can-hover:opacity-0 group-hover/comment:opacity-100 transition-opacity">
      {showResolve &&
        comment.threadId != null &&
        onResolve &&
        (actionState === 'open' || actionState === 'resolved') && (
          <ResolveButton
            threadId={comment.threadId}
            isResolved={comment.isResolved ?? false}
            onResolve={onResolve}
          />
        )}
      {showReply && onReply && (
        <button
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          title={
            replyDisabled
              ? replyDisabledReason
              : translate('auto.components.right.sidebar.checks.panel.content.c1f6fc006a', 'Reply')
          }
          disabled={replyDisabled}
          onClick={(event) => {
            event.stopPropagation()
            onReply(comment)
          }}
        >
          {translate('auto.components.right.sidebar.checks.panel.content.c1f6fc006a', 'Reply')}
        </button>
      )}
      <CopyButton text={buildCopyText(comment)} />
      <CommentMoreMenu
        comment={comment}
        botAuthorOverrides={botAuthorOverrides}
        onStartEdit={canMutateComment && onEditComment ? handleStartEdit : undefined}
        onDelete={canMutateComment && onDeleteComment ? handleDelete : undefined}
        onQueueForAgent={!isReply ? onQueueForAgent : undefined}
      />
    </div>
  ) : null

  const commentActions = !editing ? (
    // Why ml-auto: the author used to grow and carry these to the far edge, but it no longer does --
    // it was dragging the timestamp beside it out to the edge as well. This pushes only the actions.
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {presentation.useCardLayout ? null : queueButton}
      {hoverActions}
    </div>
  ) : null

  const cardMetaRow =
    presentation.useCardLayout && !isReply ? (
      <div
        className={
          selectionControl
            ? presentation.commentHeaderMetaWithSelection
            : presentation.commentHeaderMeta
        }
      >
        {relativeTime ? <span>{relativeTime}</span> : null}
        {/* Why the negative margin: the row's gap sits on both sides of the separator, which spaces
            a single glyph as widely as the fields it divides. */}
        {relativeTime && pathBadge ? (
          <span className="-mx-1" aria-hidden>
            ·
          </span>
        ) : null}
        {automated ? (
          <span className={presentation.botBadge}>
            {translate('auto.components.right.sidebar.checks.panel.content.2ba0a32bdd', 'bot')}
          </span>
        ) : null}
        {pathBadge}
        <PRCommentActionBadge
          actionState={actionState}
          isQueued={isQueued}
          presentation={presentation}
        />
        {onQueueForAgent ? (
          <QueueForAgentButton
            className="ml-auto can-hover:opacity-0 group-hover/comment:opacity-100 group-focus-within/comment:opacity-100"
            onQueueForAgent={onQueueForAgent}
          />
        ) : null}
      </div>
    ) : null

  const authorLine =
    presentation.useCardLayout && !isReply ? (
      <>
        <div className={presentation.commentHeaderPrimary}>
          {selectionControl}
          {authorAvatar}
          {authorName}
          {commentActions}
        </div>
        {cardMetaRow}
      </>
    ) : (
      <>
        {selectionControl}
        {authorAvatar}
        {authorName}
        {relativeTime ? (
          <span
            // Why trimmed: this separator carries its own leading space, so the row's full gap on
            // top of it reads wider than the same divider does in the meta row.
            // Why the line height is forced: centred boxes only share a baseline when they are the
            // same height, and the timestamp is two points smaller than the name beside it.
            className={cn(presentation.time, presentation.useCardLayout && '-ml-1 leading-5')}
            aria-hidden={presentation.time === 'hidden'}
          >
            {presentation.useCardLayout ? `· ${relativeTime}` : relativeTime}
          </span>
        ) : null}
        {automated && (
          <span className={presentation.botBadge}>
            {translate('auto.components.right.sidebar.checks.panel.content.2ba0a32bdd', 'bot')}
          </span>
        )}
        {!isReply && pathBadge}
        {!isReply ? (
          <PRCommentActionBadge
            actionState={actionState}
            isQueued={isQueued}
            presentation={presentation}
          />
        ) : null}
        <div className="flex-1" />
        {commentActions}
      </>
    )

  return (
    <div
      className={cn(
        'group/comment min-w-0',
        presentation.commentRow,
        isReply && presentation.commentRowReply,
        comment.isResolved && presentation.resolvedContainer
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            isReply && presentation.useCardLayout
              ? presentation.commentHeaderReply
              : presentation.commentHeader
          )}
        >
          {authorLine}
        </div>
        {editing ? (
          <div
            className={cn(
              'mt-1 flex flex-col gap-1.5',
              presentation.useCardLayout ? 'px-3 pb-3' : isReply ? 'pl-5' : 'pl-[22px]'
            )}
          >
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              className="min-h-[60px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-[11px] leading-snug text-foreground"
            />
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={submittingEdit}
                onClick={handleCancelEdit}
              >
                {translate(
                  'auto.components.right.sidebar.checks.panel.content.b062f55f29',
                  'Cancel'
                )}
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={!canSaveEdit}
                onClick={(event) => void handleSaveEdit(event)}
              >
                {translate('auto.components.right.sidebar.checks.panel.content.f6a40263ff', 'Save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className={isReply ? presentation.commentBodyReply : presentation.commentBody}>
            <CommentMarkdown content={comment.body} className={presentation.commentBodyMarkdown} />
            <CommentReactions
              reactions={comment.reactions}
              onReactionChange={
                comment.reactionSubjectId && onSetReaction
                  ? (content, reacted) => onSetReaction(comment, content, reacted)
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
