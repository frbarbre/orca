import React from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getPRCommentPresentationClasses } from '@/components/right-sidebar/pr-comment-presentation'
import { PendingReviewCommentCard } from './PendingReviewCommentCard'
import { usePendingReviewQueue } from './use-pending-review-queue'

/**
 * The review comments queued but not yet sent, above the ones that have been.
 *
 * Why they are not folded into the comment groups: everything in that list came back from
 * the provider and can be replied to, resolved and reacted to. A draft can do none of
 * that, and a shape that pretends otherwise would reach every consumer of a group.
 */
export function PendingReviewPanelSection(): React.JSX.Element | null {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const queue = usePendingReviewQueue(worktreeId)
  if (queue.comments.length === 0) {
    return null
  }
  // Why the list's own classes rather than a spacing of its own: this section sits directly
  // above the posted comments, and any padding that does not match theirs shows up as an
  // uneven gap between the two.
  const presentation = getPRCommentPresentationClasses()
  return (
    <>
      <div className={presentation.list}>
        <div
          className={cn(
            presentation.sectionTriageLabel,
            'flex items-center gap-1.5 px-0 text-status-warning'
          )}
        >
          {translate('auto.components.pendingReview.sectionTitle', 'Pending review')}
          <span className="tabular-nums">{queue.comments.length}</span>
        </div>
        {queue.comments.map((comment) => (
          <PendingReviewCommentCard
            key={comment.id}
            comment={comment}
            onChangeBody={(body) => queue.updateBody(comment.id, body)}
            onRemove={() => queue.remove(comment.id)}
          />
        ))}
      </div>
      {/* Why a sibling rather than a border on the list: the list sets padding with py-2, which
          wins over any pb-* added beside it, so the space above the rule could not be tuned. */}
      <div className="mx-3 my-1 border-b border-border" />
    </>
  )
}
