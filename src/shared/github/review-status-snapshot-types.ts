import type { CheckStatus, GitHubRepositoryIdentity } from './pull-request-types'

export type ReviewSnapshotPRState = 'OPEN' | 'CLOSED' | 'MERGED'

export type ReviewSnapshotReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING'

// Why: upstream's reviewer mapper requires a `login` and therefore drops team
// reviewers entirely. Carrying the discriminator keeps both kinds addressable.
export type ReviewSnapshotRequestedReviewer =
  | { kind: 'user'; login: string }
  | { kind: 'team'; slug: string }

export type ReviewSnapshotLatestReview = {
  login: string
  state: ReviewSnapshotReviewState
  /** The commit that review was left on, which a re-opened workspace can diff against. */
  commitOid: string | null
}

// Why: the shared rollup normalizer rewrites every name to `check-<index>`, so a
// rule that matches one named job needs its own shape.
export type ReviewSnapshotCheck = {
  name: string
  state: CheckStatus
}

export type ReviewSnapshotPullRequest = {
  repo: GitHubRepositoryIdentity
  number: number
  title: string
  url: string
  author: string | null
  isDraft: boolean
  state: ReviewSnapshotPRState
  headRefName: string
  baseRefName: string
  headRefOid: string
  requestedReviewers: ReviewSnapshotRequestedReviewer[]
  latestReviews: ReviewSnapshotLatestReview[]
  checks: ReviewSnapshotCheck[]
}

export type ReviewStatusSnapshotRequest = {
  repoPath: string
  linkedPullRequests: { repo: GitHubRepositoryIdentity; number: number }[]
  includeReviewInbox: boolean
  /** Repositories the review inbox search is limited to. Empty disables the search. */
  reviewInboxRepos: GitHubRepositoryIdentity[]
  /** `org/team-slug`; membership logins are resolved and cached separately. */
  pmApprovalTeam: string | null
}

export type ReviewStatusSnapshot = {
  viewerLogin: string | null
  linkedPullRequests: ReviewSnapshotPullRequest[]
  reviewRequestedPullRequests: ReviewSnapshotPullRequest[]
  pmApprovalTeamLogins: string[]
  fetchedAt: number
}
