import React, { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  isReviewDiffBase,
  type ReviewDiffBase
} from '@/components/pending-review/use-review-diff-base'
import {
  buildReviewBaseOptions,
  type PullRequestCommitSummary,
  type ViewerReviewSummary
} from '../../../../../../shared/github/review-history'

function ReviewTags({ ordinals }: { ordinals: readonly number[] }): React.JSX.Element | null {
  if (ordinals.length === 0) {
    return null
  }
  return (
    <span className="ml-auto flex shrink-0 gap-1">
      {ordinals.map((ordinal) => (
        <span
          key={ordinal}
          className="rounded bg-accent px-1 text-[10px] font-medium text-accent-foreground"
        >
          {translate('auto.components.sourceControl.pendingReview.reviewTag', 'Review {{n}}', {
            n: ordinal
          })}
        </span>
      ))}
    </span>
  )
}

export function PendingReviewDiffBaseSelect({
  value,
  onChange,
  commits,
  viewerReviews,
  baseRefName,
  sinceReviewDisabled
}: {
  value: ReviewDiffBase
  onChange: (next: ReviewDiffBase) => void
  commits: readonly PullRequestCommitSummary[]
  viewerReviews: readonly ViewerReviewSummary[]
  baseRefName: string
  sinceReviewDisabled: boolean
}): React.JSX.Element {
  const options = useMemo(
    () => buildReviewBaseOptions(commits, viewerReviews),
    [commits, viewerReviews]
  )
  const latestReview = viewerReviews.at(-1)
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isReviewDiffBase(next)) {
          onChange(next)
        }
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-full"
        aria-label={translate(
          'auto.components.sourceControl.pendingReview.diffBaseLabel',
          'What the diff compares against'
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" side="bottom" align="start" className="max-h-80">
        <SelectItem value="since-review" disabled={sinceReviewDisabled || !latestReview}>
          <span className="truncate">
            {latestReview
              ? translate(
                  'auto.components.sourceControl.pendingReview.sinceReviewN',
                  'Since your last review (Review {{n}})',
                  { n: latestReview.ordinal }
                )
              : translate(
                  'auto.components.sourceControl.pendingReview.sinceReview',
                  'Since last review'
                )}
          </span>
        </SelectItem>
        {options.length > 0 ? <SelectSeparator /> : null}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="font-mono text-[11px] text-muted-foreground">
              {option.commitOid.slice(0, 7)}
            </span>
            <span className="min-w-0 truncate">
              {option.onBranch
                ? option.headline
                : translate(
                    'auto.components.sourceControl.pendingReview.rebasedAway',
                    'Reviewed before a rebase'
                  )}
            </span>
            <ReviewTags ordinals={option.reviewOrdinals} />
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value="whole">
          <span className="truncate">
            {translate(
              'auto.components.sourceControl.pendingReview.targetBranch',
              '{{branch}} · target branch',
              { branch: baseRefName }
            )}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
