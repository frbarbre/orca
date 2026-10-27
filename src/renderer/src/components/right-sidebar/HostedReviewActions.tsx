import React, { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { runWorktreeDelete } from '../sidebar/delete-worktree-flow'
import { getDeleteStateForWorktreeHost } from '../sidebar/worktree-delete-state-host-match'
import {
  ClosedReviewActions,
  HostedReviewActionError,
  MergedReviewActions
} from './HostedReviewStateActions'
import { useHostedReviewActions, type HostedReviewActionInfo } from './use-hosted-review-actions'

export default function HostedReviewActions({
  review,
  githubPR,
  repo,
  worktree,
  onRefreshReview
}: {
  review: HostedReviewActionInfo
  githubPR?: PRInfo | null
  repo: Repo
  worktree: Worktree
  onRefreshReview: () => Promise<void>
}): React.JSX.Element | null {
  const isDeletingWorktree = useAppStore(
    (s) => getDeleteStateForWorktreeHost(worktree, s.deleteStateByWorktreeId)?.isDeleting ?? false
  )
  const isGitLab = review.provider === 'gitlab'
  const shortLabel = isGitLab ? 'MR' : 'PR'
  const reviewLabel = isGitLab ? 'merge request' : 'pull request'
  const { stateUpdating, actionError, handleReopenReview } = useHostedReviewActions({
    review,
    githubPR,
    repo,
    isGitLab,
    shortLabel,
    reviewLabel,
    defaultMergeMethod: 'squash',
    autoMergeAction: null,
    onRefreshReview
  })

  const handleDeleteWorktree = useCallback(() => {
    // Why: route every UI delete entry point through the shared funnel so
    // skip-confirm, main-worktree, and child-workspace safeguards cannot drift.
    runWorktreeDelete(worktree.id, worktree.hostId ? { expectedHostId: worktree.hostId } : {})
  }, [worktree.hostId, worktree.id])

  // Fork: an open review is merged and a draft marked ready from the top bar's next-action button,
  // and both are closed from the review header's More actions menu, so neither has a panel button.
  if (review.state === 'open' || review.state === 'draft') {
    return actionError ? <HostedReviewActionError message={actionError} /> : null
  }

  if (review.state === 'closed') {
    return (
      <ClosedReviewActions
        shortLabel={shortLabel}
        stateUpdating={stateUpdating}
        actionError={actionError}
        onReopenReview={() => void handleReopenReview()}
      />
    )
  }
  if (review.state === 'merged') {
    return (
      <MergedReviewActions
        isMainWorktree={worktree.isMainWorktree}
        isDeletingWorktree={isDeletingWorktree}
        onDeleteWorktree={handleDeleteWorktree}
      />
    )
  }

  return null
}
