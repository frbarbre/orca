import { gitLabApiFor } from '@/runtime/gitlab-owner-api'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { useCallback, useState } from 'react'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import type { GitHubPRAutoMergeAction } from '@/components/github-pr-merge-state'
import type { HostedReviewInfo } from '../../../../shared/hosted-review'
import type { GitHubPRMergeMethod, PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import {
  mergeGitHubHostedReview,
  setGitHubHostedReviewAutoMerge
} from './hosted-review-github-actions'
import { buildGitHubPRStackMergeConfirmation } from './github-pr-stack-confirmation'
import { useReadyHostedReviewAction } from './use-ready-hosted-review-action'
import { useHostedReviewStateChange } from './use-hosted-review-state-change'

export type HostedReviewActionInfo = Pick<
  HostedReviewInfo,
  'provider' | 'number' | 'state' | 'status' | 'mergeable'
> &
  Partial<
    Pick<
      HostedReviewInfo,
      | 'reviewDecision'
      | 'autoMergeEnabled'
      | 'autoMergeAllowed'
      | 'mergeQueueRequired'
      | 'mergeStateStatus'
    >
  >

export function useHostedReviewActions({
  review,
  githubPR,
  repo,
  isGitLab,
  shortLabel,
  reviewLabel,
  defaultMergeMethod,
  autoMergeAction,
  onRefreshReview
}: {
  review: HostedReviewActionInfo
  githubPR?: PRInfo | null
  repo: Repo
  isGitLab: boolean
  shortLabel: string
  reviewLabel: string
  defaultMergeMethod: GitHubPRMergeMethod
  autoMergeAction: GitHubPRAutoMergeAction | null
  onRefreshReview: () => Promise<void>
}): {
  merging: boolean
  readying: boolean
  stateUpdating: 'open' | 'closed' | null
  actionError: string | null
  handleMerge: (method?: GitHubPRMergeMethod) => Promise<void>
  handleAutoMerge: () => Promise<void>
  handleMarkReadyForReview: () => Promise<void>
  handleCloseReview: () => Promise<void>
  handleReopenReview: () => Promise<void>
} {
  const confirm = useConfirmationDialog()
  const [merging, setMerging] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { stateUpdating, handleCloseReview, handleReopenReview } = useHostedReviewStateChange({
    review,
    githubPR,
    repo,
    onRefreshReview,
    onError: setActionError
  })
  const { readying, handleMarkReadyForReview } = useReadyHostedReviewAction({
    reviewNumber: review.number,
    githubPR,
    repo,
    isGitLab,
    shortLabel,
    reviewLabel,
    onRefreshReview,
    setActionError
  })

  const handleMerge = useCallback(
    async (method: GitHubPRMergeMethod = defaultMergeMethod) => {
      if (!isGitLab && githubPR?.stack) {
        const usesMergeQueue =
          review.mergeQueueRequired === true || githubPR.mergeQueueRequired === true
        const confirmed = await confirm(
          buildGitHubPRStackMergeConfirmation({
            stack: githubPR.stack,
            currentPRNumber: review.number,
            method,
            usesMergeQueue
          })
        )
        if (!confirmed) {
          return
        }
      }
      setMerging(true)
      setActionError(null)
      try {
        const result = isGitLab
          ? await gitLabApiFor({
              repoPath: repo.path,
              repoOwnerExecutionHostId: getRepoExecutionHostId(repo)
            }).mergeMR({
              repoPath: repo.path,
              repoId: repo.id,
              iid: review.number,
              method
            })
          : await mergeGitHubHostedReview({
              repo,
              prNumber: review.number,
              method,
              prRepo: githubPR?.prRepo ?? null
            })
        if (!result.ok) {
          setActionError(result.error)
        } else {
          await onRefreshReview()
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Merge failed')
      } finally {
        setMerging(false)
      }
    },
    [
      confirm,
      githubPR?.prRepo,
      githubPR?.mergeQueueRequired,
      githubPR?.stack,
      isGitLab,
      defaultMergeMethod,
      onRefreshReview,
      repo,
      review.mergeQueueRequired,
      review.number
    ]
  )

  const handleAutoMerge = useCallback(async () => {
    if (isGitLab || !autoMergeAction) {
      return
    }
    const enabled = autoMergeAction.kind === 'enable'
    setMerging(true)
    setActionError(null)
    try {
      const result = await setGitHubHostedReviewAutoMerge({
        repo,
        prNumber: review.number,
        enabled,
        method: enabled ? defaultMergeMethod : undefined,
        prRepo: githubPR?.prRepo ?? null
      })
      if (!result.ok) {
        setActionError(result.error)
        // Refresh stale eligibility without replacing the provider's mutation error.
        await onRefreshReview().catch(() => {})
      } else {
        await onRefreshReview()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Auto-merge update failed')
    } finally {
      setMerging(false)
    }
  }, [
    githubPR?.prRepo,
    isGitLab,
    autoMergeAction,
    defaultMergeMethod,
    onRefreshReview,
    repo,
    review.number
  ])

  return {
    merging,
    readying,
    stateUpdating,
    actionError,
    handleMerge,
    handleAutoMerge,
    handleMarkReadyForReview,
    handleCloseReview,
    handleReopenReview
  }
}
