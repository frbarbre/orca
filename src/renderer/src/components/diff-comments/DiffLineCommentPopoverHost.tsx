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
  onReviewPosted
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
      placeholder={effectiveMode === 'review' ? 'Leave a review comment on this line' : placeholder}
      submitLabel={effectiveMode === 'review' ? 'Comment' : submitLabel}
      submittingLabel="Posting…"
      onCancel={onCancel}
      onSubmit={async (body) => {
        if (effectiveMode !== 'review') {
          await onSubmitNote(body)
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
