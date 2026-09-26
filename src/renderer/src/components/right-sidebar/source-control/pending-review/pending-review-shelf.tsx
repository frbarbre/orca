import React, { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  canSubmitReviewVerdict,
  type ReviewVerdict
} from '../../../../../../shared/github/pending-review-comment'
import type { PendingReviewQueue } from '@/components/pending-review/use-pending-review-queue'
import { PendingReviewCommentCard } from '@/components/pending-review/PendingReviewCommentCard'

const VERDICTS: { id: ReviewVerdict; label: string }[] = [
  { id: 'comment', label: 'Comment' },
  { id: 'approve', label: 'Approve' },
  { id: 'request-changes', label: 'Request changes' }
]

export function SourceControlPendingReviewShelf({
  queue,
  onSubmit
}: {
  queue: PendingReviewQueue
  onSubmit: (verdict: ReviewVerdict, body: string) => Promise<{ ok: boolean; error?: string }>
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState<ReviewVerdict | null>(null)

  const submit = async (verdict: ReviewVerdict): Promise<void> => {
    setSubmitting(verdict)
    const result = await onSubmit(verdict, body.trim())
    setSubmitting(null)
    if (result.ok) {
      setBody('')
      setExpanded(false)
      return
    }
    // Why the queue is untouched: a rejected verdict must not cost the reviewer their comments.
    toast.error(result.error ?? 'Could not submit the review.')
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1 py-1.5 pl-3 pr-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span className="truncate">
            {translate(
              'auto.components.sourceControl.pendingReview.count',
              '{{value0}} pending review comments',
              { value0: queue.comments.length }
            )}
          </span>
        </button>
      </div>
      <div className={cn('space-y-2 px-3 pb-2', !expanded && 'hidden')}>
        <div className="scrollbar-sleek max-h-64 space-y-2 overflow-y-auto">
          {queue.comments.map((comment) => (
            <PendingReviewCommentCard
              key={comment.id}
              comment={comment}
              onChangeBody={(next) => queue.updateBody(comment.id, next)}
              onRemove={() => queue.remove(comment.id)}
            />
          ))}
        </div>
        <Textarea
          value={body}
          placeholder={translate(
            'auto.components.sourceControl.pendingReview.bodyPlaceholder',
            'Summary for the whole review (required to request changes)'
          )}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-16"
        />
        <div className="flex flex-wrap justify-end gap-1">
          {VERDICTS.map((verdict) => (
            <Button
              key={verdict.id}
              size="sm"
              variant={verdict.id === 'comment' ? 'secondary' : 'default'}
              disabled={
                submitting !== null ||
                !canSubmitReviewVerdict({
                  verdict: verdict.id,
                  body,
                  pendingCount: queue.comments.length
                })
              }
              onClick={() => void submit(verdict.id)}
            >
              {submitting === verdict.id
                ? translate('auto.components.sourceControl.pendingReview.submitting', 'Sending…')
                : verdict.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
