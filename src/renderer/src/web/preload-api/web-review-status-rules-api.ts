import type { ReviewStatusSnapshot } from '../../../../shared/github/review-status-snapshot-types'
import type { PreloadApi } from '../../../../preload/api-types'

const EMPTY_SNAPSHOT: ReviewStatusSnapshot = {
  viewerLogin: null,
  linkedPullRequests: [],
  reviewRequestedPullRequests: [],
  pmApprovalTeamLogins: [],
  fetchedAt: 0
}

// Why an empty snapshot rather than an RPC route: the rules run against the
// desktop app's own worktrees, which the web client does not own.
export function createWebReviewStatusRulesApi(): Pick<PreloadApi, 'reviewStatusRules'> {
  return {
    reviewStatusRules: {
      snapshot: () => Promise.resolve({ ...EMPTY_SNAPSHOT, fetchedAt: Date.now() })
    }
  }
}
