import React, { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { runWorktreeDelete } from '../sidebar/delete-worktree-flow'
import { getDeleteStateForWorktreeHost } from '../sidebar/worktree-delete-state-host-match'
import {
  ClosedReviewActions,
  DraftReviewActions,
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
  const {
    readying,
    stateUpdating,
    actionError,
    handleMarkReadyForReview,
    handleCloseReview,
    handleReopenReview
  } = useHostedReviewActions({
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

  if (review.state === 'draft' && (review.provider === 'github' || review.provider === 'gitlab')) {
    return (
      <DraftReviewActions
        shortLabel={shortLabel}
        reviewLabel={reviewLabel}
        isGitLab={isGitLab}
        readying={readying}
        stateUpdating={stateUpdating}
        actionError={actionError}
        onMarkReadyForReview={() => void handleMarkReadyForReview()}
        onCloseReview={() => void handleCloseReview()}
      />
    )
  }

  // Fork: an open review is merged from Source Control's primary button and closed from the
  // review header's More actions menu, so the panel keeps no merge button of its own.
  if (review.state === 'open') {
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
