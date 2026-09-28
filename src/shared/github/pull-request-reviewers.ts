export type PullRequestReviewerState =
  /** Asked for a review and has not given one yet. */
  | 'pending'
  /** Reviewed before and has been asked to look again. */
  | 're-requested'
  | 'approved'
  | 'changes-requested'
  | 'commented'
  | 'dismissed'

export type PullRequestReviewer = {
  kind: 'user' | 'team'
  /** A user's login, or a team's slug. */
  login: string
  name: string | null
  avatarUrl: string | null
  state: PullRequestReviewerState
  /** A reviewer who has already reviewed can be asked to review again. */
  canRerequest: boolean
}

export type RawReviewRequest =
  | { kind: 'user'; login: string; name: string | null; avatarUrl: string | null }
  | { kind: 'team'; login: string; name: string | null }

export type RawReview = {
  login: string
  avatarUrl: string | null
  /** APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING */
  state: string
}

const REVIEWED_STATES: Record<string, PullRequestReviewerState> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  COMMENTED: 'commented',
  DISMISSED: 'dismissed'
}

/**
 * The reviewers of a pull request and where each one stands, in the order GitHub lists them.
 *
 * Why both review lists: GitHub drops a reviewer from latestReviews once they are re-requested,
 * while latestOpinionatedReviews keeps their last approve or request-changes, so only the pair
 * tells a first request from a re-request. A plain comment only ever shows in latestReviews.
 */
export function buildPullRequestReviewers(input: {
  requests: readonly RawReviewRequest[]
  latestReviews: readonly RawReview[]
  latestOpinionatedReviews: readonly RawReview[]
  authorLogin: string | null
}): PullRequestReviewer[] {
  const author = input.authorLogin?.toLowerCase() ?? null
  const key = (login: string): string => login.toLowerCase()
  const opinionated = new Map(
    input.latestOpinionatedReviews.map((review) => [key(review.login), review])
  )
  const latest = new Map(input.latestReviews.map((review) => [key(review.login), review]))
  const reviewers: PullRequestReviewer[] = []
  const seen = new Set<string>()

  for (const request of input.requests) {
    seen.add(`${request.kind}:${key(request.login)}`)
    const hasReviewed =
      request.kind === 'user' &&
      (opinionated.has(key(request.login)) || latest.has(key(request.login)))
    const avatarUrl =
      request.kind === 'user'
        ? (request.avatarUrl ?? opinionated.get(key(request.login))?.avatarUrl ?? null)
        : null
    reviewers.push({
      kind: request.kind,
      login: request.login,
      name: request.name,
      avatarUrl,
      state: hasReviewed ? 're-requested' : 'pending',
      canRerequest: false
    })
  }

  for (const review of [...input.latestReviews, ...input.latestOpinionatedReviews]) {
    const id = `user:${key(review.login)}`
    if (seen.has(id) || key(review.login) === author) {
      continue
    }
    seen.add(id)
    const standing = opinionated.get(key(review.login)) ?? latest.get(key(review.login)) ?? review
    const state = REVIEWED_STATES[standing.state.toUpperCase()]
    if (!state) {
      continue
    }
    reviewers.push({
      kind: 'user',
      login: review.login,
      name: null,
      avatarUrl: review.avatarUrl ?? standing.avatarUrl,
      state,
      canRerequest: true
    })
  }
  return reviewers
}
