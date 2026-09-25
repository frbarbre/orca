import type { CheckStatus } from '../../shared/github/pull-request-types'
import type {
  ReviewSnapshotCheck,
  ReviewSnapshotLatestReview,
  ReviewSnapshotPRState,
  ReviewSnapshotPullRequest,
  ReviewSnapshotRequestedReviewer,
  ReviewSnapshotReviewState
} from '../../shared/github/review-status-snapshot-types'

type RawNode = Record<string, unknown>

function asRecord(value: unknown): RawNode | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

function asNodes(value: unknown): RawNode[] {
  const container = asRecord(value)
  const nodes = container?.nodes
  if (!Array.isArray(nodes)) {
    return []
  }
  const records: RawNode[] = []
  for (const node of nodes) {
    const record = asRecord(node)
    if (record) {
      records.push(record)
    }
  }
  return records
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function mapCheckRunState(status: string, conclusion: string): CheckStatus {
  if (status !== 'COMPLETED') {
    return 'pending'
  }
  if (conclusion === 'SUCCESS') {
    return 'success'
  }
  if (conclusion === 'NEUTRAL' || conclusion === 'SKIPPED') {
    return 'neutral'
  }
  return conclusion ? 'failure' : 'pending'
}

function mapStatusContextState(state: string): CheckStatus {
  if (state === 'SUCCESS') {
    return 'success'
  }
  if (state === 'FAILURE' || state === 'ERROR') {
    return 'failure'
  }
  return 'pending'
}

function mapChecks(pr: RawNode): ReviewSnapshotCheck[] {
  const commit = asRecord(asNodes(pr.commits)[0]?.commit)
  const contexts = asNodes(asRecord(commit?.statusCheckRollup)?.contexts)
  return contexts.flatMap((context) => {
    if (context.__typename === 'CheckRun') {
      const name = asString(context.name)
      return name
        ? [
            {
              name,
              state: mapCheckRunState(
                asString(context.status).toUpperCase(),
                asString(context.conclusion).toUpperCase()
              )
            }
          ]
        : []
    }
    const name = asString(context.context)
    return name
      ? [{ name, state: mapStatusContextState(asString(context.state).toUpperCase()) }]
      : []
  })
}

function mapRequestedReviewers(pr: RawNode): ReviewSnapshotRequestedReviewer[] {
  return asNodes(pr.reviewRequests).flatMap<ReviewSnapshotRequestedReviewer>((request) => {
    const reviewer = asRecord(request.requestedReviewer)
    if (!reviewer) {
      return []
    }
    const login = asString(reviewer.login)
    if (login) {
      return [{ kind: 'user', login }]
    }
    const slug = asString(reviewer.slug)
    return slug ? [{ kind: 'team', slug }] : []
  })
}

const REVIEW_STATES: readonly ReviewSnapshotReviewState[] = [
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'PENDING'
]

function isReviewState(value: string): value is ReviewSnapshotReviewState {
  return REVIEW_STATES.some((state) => state === value)
}

function mapLatestReviews(pr: RawNode): ReviewSnapshotLatestReview[] {
  return asNodes(pr.latestReviews).flatMap((review) => {
    const login = asString(asRecord(review.author)?.login)
    const state = asString(review.state).toUpperCase()
    return login && isReviewState(state) ? [{ login, state }] : []
  })
}

function mapPRState(value: string): ReviewSnapshotPRState {
  const state = value.toUpperCase()
  return state === 'MERGED' || state === 'CLOSED' ? state : 'OPEN'
}

export function mapReviewSnapshotPullRequest(value: unknown): ReviewSnapshotPullRequest | null {
  const pr = asRecord(value)
  const repository = asRecord(pr?.repository)
  const owner = asString(asRecord(repository?.owner)?.login)
  const repo = asString(repository?.name)
  const number = typeof pr?.number === 'number' ? pr.number : 0
  if (!pr || !owner || !repo || !number) {
    return null
  }
  return {
    repo: { owner, repo },
    number,
    title: asString(pr.title),
    url: asString(pr.url),
    author: asString(asRecord(pr.author)?.login) || null,
    isDraft: pr.isDraft === true,
    state: mapPRState(asString(pr.state)),
    headRefName: asString(pr.headRefName),
    baseRefName: asString(pr.baseRefName),
    headRefOid: asString(pr.headRefOid),
    requestedReviewers: mapRequestedReviewers(pr),
    latestReviews: mapLatestReviews(pr),
    checks: mapChecks(pr)
  }
}

export function mapReviewStatusSnapshotResponse(payload: unknown): {
  viewerLogin: string | null
  linkedPullRequests: ReviewSnapshotPullRequest[]
  reviewRequestedPullRequests: ReviewSnapshotPullRequest[]
} {
  const data = asRecord(asRecord(payload)?.data)
  const viewerLogin = asString(asRecord(data?.viewer)?.login) || null
  const linkedPullRequests: ReviewSnapshotPullRequest[] = []
  for (const [key, value] of Object.entries(data ?? {})) {
    if (!key.startsWith('linked')) {
      continue
    }
    const mapped = mapReviewSnapshotPullRequest(asRecord(value)?.pullRequest)
    if (mapped) {
      linkedPullRequests.push(mapped)
    }
  }
  const reviewRequestedPullRequests = asNodes(data?.inbox).flatMap(
    (node) => mapReviewSnapshotPullRequest(node) ?? []
  )
  return { viewerLogin, linkedPullRequests, reviewRequestedPullRequests }
}
