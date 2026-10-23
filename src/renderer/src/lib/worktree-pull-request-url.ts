import type { AppState } from '@/store/types'
import {
  resolveWorktreeCardReview,
  worktreeCardReviewCacheKeys
} from '@/components/sidebar/worktree-card-review-resolution'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'

type PullRequestUrlState = Pick<
  AppState,
  | 'activeWorktreeId'
  | 'repos'
  | 'settings'
  | 'getKnownWorktreeById'
  | 'hostedReviewCache'
  | 'prCache'
>

export type ActiveGitHubPullRequest = {
  worktreeId: string
  repoPath: string
  repoId: string
  prNumber: number
  prRepo: GitHubOwnerRepo | null
}

function activeWorktreeReview(state: PullRequestUrlState) {
  const worktree = state.activeWorktreeId
    ? state.getKnownWorktreeById(state.activeWorktreeId)
    : undefined
  if (!worktree) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  const { hostedReviewCacheKey, prCacheKey } = worktreeCardReviewCacheKeys(
    worktree,
    repo,
    state.settings
  )
  const { prDisplay } = resolveWorktreeCardReview(
    worktree,
    hostedReviewCacheKey ? state.hostedReviewCache[hostedReviewCacheKey] : undefined,
    prCacheKey ? state.prCache?.[prCacheKey] : undefined
  )
  return prDisplay ? { worktree, repo, prDisplay } : null
}

/** The URL of the review the active workspace's card shows, when it has one. */
export function activeWorktreePullRequestUrl(state: PullRequestUrlState): string | null {
  return activeWorktreeReview(state)?.prDisplay.url ?? null
}

export function activeWorktreeGitHubPullRequest(
  state: PullRequestUrlState
): ActiveGitHubPullRequest | null {
  const review = activeWorktreeReview(state)
  if (!review?.repo || review.prDisplay.provider !== 'github') {
    return null
  }
  const { worktree, repo, prDisplay } = review
  return {
    worktreeId: worktree.id,
    repoPath: repo.path,
    repoId: repo.id,
    prNumber: prDisplay.number,
    prRepo: ('githubRepository' in prDisplay ? prDisplay.githubRepository : undefined) ?? null
  }
}
