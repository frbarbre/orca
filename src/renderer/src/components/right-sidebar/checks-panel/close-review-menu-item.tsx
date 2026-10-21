import React from 'react'
import { GitPullRequestClosed } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import type { PRInfo } from '../../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../../shared/repo-types'
import type { HostedReviewActionInfo } from '../use-hosted-review-actions'
import { useHostedReviewStateChange } from '../use-hosted-review-state-change'
import { translate } from '@/i18n/i18n'

export type CloseReviewTarget = {
  repo: Repo
  githubPR: PRInfo | null
  onRefreshReview: () => Promise<void>
}

export function CloseReviewMenuItem({
  review,
  target
}: {
  review: Pick<HostedReviewActionInfo, 'provider' | 'number'>
  target: CloseReviewTarget
}): React.JSX.Element {
  const { stateUpdating, handleCloseReview } = useHostedReviewStateChange({
    review,
    githubPR: target.githubPR,
    repo: target.repo,
    onRefreshReview: target.onRefreshReview
  })
  const shortLabel = review.provider === 'gitlab' ? 'MR' : 'PR'
  return (
    <DropdownMenuItem
      variant="destructive"
      disabled={stateUpdating !== null}
      onSelect={() => void handleCloseReview()}
    >
      <GitPullRequestClosed className="size-3.5" />
      {translate('auto.components.right.sidebar.HostedReviewActions.4d5fb5a284', 'Close')}{' '}
      {shortLabel}
    </DropdownMenuItem>
  )
}
