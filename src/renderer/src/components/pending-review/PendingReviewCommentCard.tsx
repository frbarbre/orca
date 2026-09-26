import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'

export function PendingReviewBadge(): React.JSX.Element {
  return (
    <span className="rounded-sm border border-status-warning-border bg-status-warning-background px-1.5 py-0.5 text-[10px] font-medium text-status-warning">
      {translate('auto.components.pendingReview.badge', 'Pending')}
    </span>
  )
}

export function PendingReviewCommentCard({
  comment,
  onChangeBody,
  onRemove,
  onContentResize
}: {
  comment: PendingReviewComment
  onChangeBody: (body: string) => void
  onRemove: () => void
  onContentResize?: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  // Why the node is state rather than a ref: the editor and the read view are different
  // elements, and re-running on the swap is what keeps the zone from clipping.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!container || !onContentResize) {
      return
    }
    const observer = new ResizeObserver(() => onContentResize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, onContentResize])

  const lineLabel =
    comment.startLine !== undefined && comment.startLine !== comment.line
      ? translate('auto.components.pendingReview.lineRange', 'Lines {{value0}}–{{value1}}', {
          value0: comment.startLine,
          value1: comment.line
        })
      : translate('auto.components.pendingReview.line', 'Line {{value0}}', {
          value0: comment.line
        })

  return (
    <div ref={setContainer} className="rounded-md border border-border bg-muted/40 p-2">
      <div className="flex items-center gap-2 pb-1.5">
        <PendingReviewBadge />
        <span className="text-xs text-muted-foreground">{lineLabel}</span>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <Textarea
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-16"
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {translate('auto.components.pendingReview.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={!draft.trim()}
              onClick={() => {
                onChangeBody(draft.trim())
                setEditing(false)
              }}
            >
              {translate('auto.components.pendingReview.save', 'Save')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
          <div className="flex justify-end gap-1 pt-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(comment.body)
                setEditing(true)
              }}
            >
              {translate('auto.components.pendingReview.edit', 'Edit')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              {translate('auto.components.pendingReview.discard', 'Discard')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
