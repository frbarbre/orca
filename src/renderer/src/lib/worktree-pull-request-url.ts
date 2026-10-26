import type { AppState } from '@/store/types'
import {
  resolveWorktreeCardReview,
  worktreeCardReviewCacheKeys
} from '@/components/sidebar/worktree-card-review-resolution'

type PullRequestUrlState = Pick<
  AppState,
  | 'activeWorktreeId'
  | 'repos'
  | 'settings'
  | 'getKnownWorktreeById'
  | 'hostedReviewCache'
  | 'prCache'
>

/** The URL of the review the active workspace's card shows, when it has one. */
export function activeWorktreePullRequestUrl(state: PullRequestUrlState): string | null {
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
  return prDisplay?.url ?? null
}
