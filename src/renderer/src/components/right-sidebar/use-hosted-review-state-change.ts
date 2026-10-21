import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { gitLabApiFor } from '@/runtime/gitlab-owner-api'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import { updateGitHubHostedReviewState } from './hosted-review-github-actions'
import type { HostedReviewActionInfo } from './use-hosted-review-actions'
import { translate } from '@/i18n/i18n'

/** Closing or reopening a review after a confirmation, shared by the PR panel's menus. */
export function useHostedReviewStateChange({
  review,
  githubPR,
  repo,
  onRefreshReview,
  onError
}: {
  review: Pick<HostedReviewActionInfo, 'provider' | 'number'>
  githubPR?: PRInfo | null
  repo: Repo
  onRefreshReview: () => Promise<void>
  onError?: (message: string | null) => void
}): {
  stateUpdating: 'open' | 'closed' | null
  handleCloseReview: () => Promise<void>
  handleReopenReview: () => Promise<void>
} {
  const confirm = useConfirmationDialog()
  const [stateUpdating, setStateUpdating] = useState<'open' | 'closed' | null>(null)
  const isGitLab = review.provider === 'gitlab'
  const shortLabel = isGitLab ? 'MR' : 'PR'
  const reviewLabel = isGitLab ? 'merge request' : 'pull request'

  const handleReviewStateChange = useCallback(
    async (nextState: 'open' | 'closed') => {
      if (stateUpdating) {
        return
      }
      const isClosing = nextState === 'closed'
      const label = isClosing ? 'Close' : 'Reopen'
      const confirmed = await confirm({
        title: `${label} ${shortLabel} ${isGitLab ? '!' : '#'}${review.number}?`,
        description: isClosing
          ? translate(
              'auto.components.right.sidebar.HostedReviewActions.a3d572a4de',
              'This will close the {{value0}}.',
              { value0: reviewLabel }
            )
          : translate(
              'auto.components.right.sidebar.HostedReviewActions.78f5ff294c',
              'This will reopen the {{value0}}.',
              { value0: reviewLabel }
            ),
        confirmLabel: label,
        confirmVariant: isClosing ? 'destructive' : 'default'
      })
      if (!confirmed) {
        return
      }
      setStateUpdating(nextState)
      onError?.(null)
      try {
        const result = isGitLab
          ? isClosing
            ? await gitLabApiFor({
                repoPath: repo.path,
                repoOwnerExecutionHostId: getRepoExecutionHostId(repo)
              }).closeMR({
                repoPath: repo.path,
                repoId: repo.id,
                iid: review.number
              })
            : await gitLabApiFor({
                repoPath: repo.path,
                repoOwnerExecutionHostId: getRepoExecutionHostId(repo)
              }).reopenMR({
                repoPath: repo.path,
                repoId: repo.id,
                iid: review.number
              })
          : await updateGitHubHostedReviewState({
              repo,
              prNumber: review.number,
              prRepo: githubPR?.prRepo ?? null,
              nextState
            })
        if (!result.ok) {
          onError?.(result.error)
          toast.error(result.error)
        } else {
          toast.success(
            isClosing
              ? translate(
                  'auto.components.right.sidebar.HostedReviewActions.closedToast',
                  '{{value0}} closed',
                  { value0: shortLabel }
                )
              : translate(
                  'auto.components.right.sidebar.HostedReviewActions.377269db6f',
                  '{{value0}} reopened',
                  { value0: shortLabel }
                )
          )
          await onRefreshReview()
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : `Failed to ${label.toLowerCase()} ${reviewLabel}`
        onError?.(message)
        toast.error(message)
      } finally {
        setStateUpdating(null)
      }
    },
    [
      confirm,
      githubPR?.prRepo,
      isGitLab,
      onError,
      onRefreshReview,
      repo,
      review.number,
      reviewLabel,
      shortLabel,
      stateUpdating
    ]
  )

  const handleCloseReview = useCallback(async () => {
    await handleReviewStateChange('closed')
  }, [handleReviewStateChange])

  const handleReopenReview = useCallback(async () => {
    await handleReviewStateChange('open')
  }, [handleReviewStateChange])

  return { stateUpdating, handleCloseReview, handleReopenReview }
}
