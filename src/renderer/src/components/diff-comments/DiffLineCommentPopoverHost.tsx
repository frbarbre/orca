import React from 'react'
import type { editor as monacoEditor } from 'monaco-editor'
import { DiffCommentPopover } from './DiffCommentPopover'
import { useDiffReviewComment } from './use-diff-review-comment'
import type { PRComment } from '../../../../shared/github/comment-types'

type PopoverAnchor = {
  lineNumber: number
  startLine?: number
  top: number
  left?: number
  lineHeight: number
}

type ReviewTarget = Parameters<typeof useDiffReviewComment>[0]['target']

/**
 * The add-comment popover for one line, and the choice of where that comment goes.
 *
 * Why it owns the choice rather than the viewer: a note and a review comment share the gesture, the
 * anchor and the draft, and differ only in destination — keeping that decision beside the popover
 * keeps the diff viewer out of it.
 */
export function DiffLineCommentPopoverHost({
  anchor,
  diffEditor,
  modelKey,
  relativePath,
  worktreeId,
  reviewTarget,
  placeholder = 'Add note for the AI',
  submitLabel = 'Add note',
  onCancel,
  onSubmitNote,
  onReviewPosted,
  onQueueForReview
}: {
  anchor: PopoverAnchor
  diffEditor: monacoEditor.IStandaloneDiffEditor | null
  modelKey: string | null
  relativePath: string
  worktreeId: string | null
  reviewTarget: ReviewTarget
  placeholder?: string
  submitLabel?: string
  onCancel: () => void
  onSubmitNote: (body: string) => Promise<void>
  onReviewPosted: (comment: PRComment) => void
  /** Queue the comment for the review instead of posting it now. */
  onQueueForReview: (body: string, line: number, startLine: number | undefined) => void
}): React.JSX.Element {
  const review = useDiffReviewComment({
    diffEditor,
    modelKey,
    target: reviewTarget,
    relativePath,
    worktreeId
  })
  const effectiveMode = review.resolveMode(anchor.lineNumber)
  const disabledReason = review.reviewDisabledReason(anchor.lineNumber)

  return (
    <DiffCommentPopover
      key={`${anchor.startLine ?? anchor.lineNumber}:${anchor.lineNumber}`}
      lineNumber={anchor.lineNumber}
      startLine={anchor.startLine}
      top={anchor.top}
      left={anchor.left}
      lineHeight={anchor.lineHeight}
      mode={effectiveMode}
      onModeChange={review.setMode}
      reviewDisabledReason={disabledReason}
      placeholder={effectiveMode === 'note' ? placeholder : 'Leave a review comment on this line'}
      submitLabel={
        effectiveMode === 'note'
          ? submitLabel
          : effectiveMode === 'review'
            ? 'Comment'
            : 'Add to review'
      }
      submittingLabel="Posting…"
      onCancel={onCancel}
      onSubmit={async (body) => {
        if (effectiveMode === 'note') {
          await onSubmitNote(body)
          return
        }
        if (effectiveMode === 'pending') {
          onQueueForReview(body, anchor.lineNumber, anchor.startLine)
          // Why dismiss here rather than in the caller: queueing has no response to wait
          // for, so the popover would otherwise stay open over the comment it just made.
          onCancel()
          return
        }
        const posted = await review.submitReviewComment(anchor.lineNumber, anchor.startLine, body)
        if (posted) {
          onReviewPosted(posted)
        }
      }}
    />
  )
}
