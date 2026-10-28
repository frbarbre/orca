import { createElement } from 'react'
import { GitMerge, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getReviewStateIcon } from '@/components/github/review-state-presentation'
import { PullRequestIcon } from './WorktreeCardHelpers'
import type { WorktreeCardPrDisplay } from './worktree-card-pr-display'

export function getReviewLabel(review: WorktreeCardPrDisplay): 'MR' | 'PR' {
  return review.provider === 'gitlab' ? 'MR' : 'PR'
}

export function getProviderName(review: WorktreeCardPrDisplay): string {
  if (review.provider === 'gitlab') {
    return 'GitLab'
  }
  if (review.provider === 'bitbucket') {
    return 'Bitbucket'
  }
  if (review.provider === 'azure-devops') {
    return 'Azure DevOps'
  }
  if (review.provider === 'gitea') {
    return 'Gitea'
  }
  return 'GitHub'
}

// Open reviews take check tones; draft/closed/merged keep state tones, and unconfirmed stateless rows flag problems only.
export function getReviewChecksTone(status: WorktreeCardPrDisplay['status']): string | null {
  if (status === 'failure') {
    return 'text-rose-500/85'
  }
  if (status === 'pending') {
    return 'text-amber-500/85'
  }
  if (status === 'success') {
    return 'text-emerald-500/80'
  }
  return null
}

// Fork: the card reads its own check status when the provider gives one, so a running check
// spins instead of the PR going red, and queued checks change nothing.
function cardCheckStatus(review: WorktreeCardPrDisplay): WorktreeCardPrDisplay['status'] {
  if (!review.cardStatus) {
    return review.status
  }
  return review.cardStatus === 'running' ? 'pending' : review.cardStatus
}

function isRunningOpenReview(review: WorktreeCardPrDisplay): boolean {
  return review.cardStatus === 'running' && (!review.state || review.state === 'open')
}

function getCheckTone(review: WorktreeCardPrDisplay): string | null {
  const status = cardCheckStatus(review)
  if ((review.state && review.state !== 'open') || (!review.state && status === 'success')) {
    return null
  }
  return getReviewChecksTone(status)
}

function getStateTone(state: WorktreeCardPrDisplay['state']): string {
  if (state === 'merged') {
    return 'text-purple-600/70 dark:text-purple-400/70'
  }
  if (state === 'open') {
    return 'text-emerald-500/80'
  }
  if (state === 'closed') {
    return 'text-muted-foreground/60'
  }
  if (state === 'draft') {
    return 'text-muted-foreground/50'
  }
  return 'text-muted-foreground opacity-70'
}

export function ReviewIcon({
  review,
  className,
  variant = 'provider',
  showChecks = true
}: {
  review: WorktreeCardPrDisplay
  className?: string
  variant?: 'provider' | 'generic'
  showChecks?: boolean
}): React.JSX.Element {
  const providerIcon =
    variant === 'provider' && review.provider === 'gitlab' ? GitMerge : PullRequestIcon
  const running = showChecks && isRunningOpenReview(review)
  const Icon = running
    ? LoaderCircle
    : (getReviewStateIcon(review.state) ?? providerIcon)
  return createElement(Icon, {
    className: cn(
      className,
      running && 'animate-spin',
      (showChecks ? getCheckTone(review) : null) ?? getStateTone(review.state)
    )
  })
}
