import React, { useState } from 'react'
import {
  Check,
  ChevronRight,
  GitPullRequest,
  MessageCircle,
  MessageSquare,
  ScanEye,
  X
} from 'lucide-react'
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
import { useReviewDiffBase } from '@/components/pending-review/use-review-diff-base'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'

const VERDICTS: {
  id: ReviewVerdict
  label: string
  Icon: typeof MessageCircle
  tone: string
}[] = [
  {
    id: 'comment',
    label: 'Only comment',
    Icon: MessageCircle,
    tone: 'text-muted-foreground'
  },
  {
    id: 'request-changes',
    label: 'Request changes',
    Icon: X,
    tone: 'text-destructive'
  },
  { id: 'approve', label: 'Approve', Icon: Check, tone: 'text-status-success' }
]

export function SourceControlPendingReviewShelf({
  queue,
  submitter,
  worktreeId
}: {
  queue: PendingReviewQueue
  submitter: ReviewVerdictSubmitter
  worktreeId: string | null
}): React.JSX.Element | null {
  const diffBase = useReviewDiffBase(
    worktreeId,
    submitter.viewerLatestReviewCommit,
    submitter.baseRefName
  )
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

  // Why the queue wins over the verdict on record: unsent comments are the newer state,
  // and saying "you approved" while drafts sit unsent would be wrong about right now.
  const standing =
    queue.comments.length > 0
      ? {
          Icon: MessageCircle,
          text: translate(
            'auto.components.sourceControl.pendingReview.standingPending',
            'Your review is pending'
          ),
          tone: 'border-status-warning-border bg-status-warning-background text-status-warning'
        }
      : submitter.viewerLatestReviewState === 'CHANGES_REQUESTED'
        ? {
            Icon: X,
            text: translate(
              'auto.components.sourceControl.pendingReview.standingChanges',
              'You requested changes'
            ),
            tone: 'border-destructive/40 bg-destructive/10 text-destructive'
          }
        : submitter.viewerLatestReviewState === 'APPROVED'
          ? {
              Icon: Check,
              text: translate(
                'auto.components.sourceControl.pendingReview.standingApproved',
                'You approved the changes'
              ),
              tone: 'border-status-success-border bg-status-success-background text-status-success'
            }
          : submitter.viewerHasReviewRequest
            ? {
                Icon: ScanEye,
                text: translate(
                  'auto.components.sourceControl.pendingReview.standingRequested',
                  'Your review was requested'
                ),
                tone: 'border-border bg-muted text-muted-foreground'
              }
            : null

  return (
    <div className="border-b border-border">
      {diffBase.available ? (
        <div className="px-3 pt-2">
          {/* Why here and not in the base-ref dialog: this is a reading choice a reviewer
              makes repeatedly while working through a pull request, not repo configuration. */}
          <SegmentedTabs
            ariaLabel={translate(
              'auto.components.sourceControl.pendingReview.diffBaseLabel',
              'What the diff compares against'
            )}
            options={[
              {
                id: 'since-review' as const,
                Icon: ScanEye,
                label: translate(
                  'auto.components.sourceControl.pendingReview.sinceReview',
                  'Since last review'
                ),
                disabledReason: diffBase.sinceReviewMissing
                  ? translate(
                      'auto.components.sourceControl.pendingReview.sinceReviewMissing',
                      'The commit you last reviewed is no longer in this checkout.'
                    )
                  : undefined
              },
              {
                id: 'whole' as const,
                Icon: GitPullRequest,
                label: translate(
                  'auto.components.sourceControl.pendingReview.wholePr',
                  'Whole pull request'
                )
              }
            ]}
            fullWidth
            value={diffBase.value}
            onChange={diffBase.setValue}
          />
        </div>
      ) : null}
      {standing ? (
        <div className="px-3 pt-2">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
              standing.tone
            )}
          >
            <standing.Icon className="size-3 shrink-0" />
            {standing.text}
          </div>
        </div>
      ) : null}
      <div className="px-3 pt-2 pb-2">
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
      {/* Why hidden at zero: a disclosure that opens onto nothing is chrome, and the
          form above is the part of this shelf that is always worth showing. */}
      {queue.comments.length > 0 ? (
        <>
          <div className="flex items-center gap-1 pt-1 pb-3 pl-3 pr-2">
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
        </>
      ) : null}
    </div>
  )
}
