import React, { useState } from 'react'
import { Check, ChevronRight, MessageCircle, MessageSquare, X } from 'lucide-react'
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
import type { ReviewVerdictSubmitter } from '@/components/pending-review/use-submit-review-verdict'
import { PendingReviewCommentCard } from '@/components/pending-review/PendingReviewCommentCard'

const VERDICTS: {
  id: ReviewVerdict
  label: string
  Icon: typeof MessageCircle
  tone: string
}[] = [
  { id: 'comment', label: 'Only comment', Icon: MessageCircle, tone: 'text-muted-foreground' },
  { id: 'request-changes', label: 'Request changes', Icon: X, tone: 'text-destructive' },
  { id: 'approve', label: 'Approve', Icon: Check, tone: 'text-status-success' }
]

export function SourceControlPendingReviewShelf({
  queue,
  submitter
}: {
  queue: PendingReviewQueue
  submitter: ReviewVerdictSubmitter
}): React.JSX.Element | null {
  // Why closed by default: the drafts are a reference you open when you want them, while
  // the form below is the thing a reviewer comes here to use.
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState<ReviewVerdict | null>(null)

  const submit = async (verdict: ReviewVerdict): Promise<void> => {
    setSubmitting(verdict)
    const result = await submitter.submit(verdict, body.trim())
    setSubmitting(null)
    if (result.ok) {
      setBody('')
      setExpanded(false)
      return
    }
    // Why the queue is untouched: a rejected verdict must not cost the reviewer their comments.
    toast.error(result.error ?? 'Could not submit the review.')
  }

  if (submitter.prNumber === null) {
    return null
  }
  // Why only a comment on your own work: the provider refuses an approve or a
  // request-changes from the author, so offering them would be a button that always fails.
  const verdicts = submitter.viewerDidAuthor
    ? VERDICTS.filter((verdict) => verdict.id === 'comment')
    : VERDICTS

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1 py-1.5 pl-3 pr-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <ChevronRight
            className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-90')}
          />
          <MessageSquare className="size-3.5 shrink-0" />
          <span className="truncate font-medium text-foreground">
            {translate('auto.components.sourceControl.pendingReview.title', 'Pending review')}
          </span>
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] tabular-nums">
            {queue.comments.length}
          </span>
        </button>
      </div>
      <div className={cn('px-3 pb-2', !expanded && 'hidden')}>
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
      </div>
      <div className="px-3 pb-2">
        <div className="rounded-md border border-input bg-background shadow-xs dark:bg-input/30">
          <Textarea
            value={body}
            placeholder={translate(
              'auto.components.sourceControl.pendingReview.bodyPlaceholder',
              'Add review summary…'
            )}
            onChange={(event) => setBody(event.target.value)}
            variant="seamless"
            className="min-h-16 resize-none"
          />
          <div className="flex flex-wrap items-center justify-end gap-0.5 px-1.5 pb-1.5">
            {verdicts.map((verdict) => (
              <Button
                key={verdict.id}
                size="xs"
                variant="ghost"
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
                <verdict.Icon className={cn('size-3', verdict.tone)} />
                {submitting === verdict.id
                  ? translate('auto.components.sourceControl.pendingReview.submitting', 'Sending…')
                  : verdict.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
