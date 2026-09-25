import type { GitHubRepositoryIdentity } from '../../shared/github/pull-request-types'

/** Bounds one GraphQL document so a large board cannot build an unbounded query. */
export const MAX_SNAPSHOT_LINKED_PRS = 60
export const REVIEW_INBOX_PAGE_SIZE = 30
const REVIEW_INBOX_BASE_SEARCH = 'is:pr is:open review-requested:@me archived:false'

export function buildReviewInboxSearch(repos: readonly GitHubRepositoryIdentity[]): string | null {
  // Why: an unscoped review-requested search reaches every repository the
  // account can see, which is never what a per-project rule set means.
  const qualifiers = repos.map((repo) => `repo:${repo.owner}/${repo.repo}`)
  return qualifiers.length > 0 ? `${REVIEW_INBOX_BASE_SEARCH} ${qualifiers.join(' ')}` : null
}

const PR_FIELDS_FRAGMENT = `fragment SnapshotPR on PullRequest {
  number
  title
  url
  isDraft
  state
  headRefName
  baseRefName
  headRefOid
  author { login }
  repository { name owner { login } }
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        __typename
        ... on User { login }
        ... on Team { slug }
      }
    }
  }
  latestReviews(first: 20) {
    nodes { state author { login } }
  }
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun { name status conclusion }
              ... on StatusContext { context state }
            }
          }
        }
      }
    }
  }
}`

export function snapshotLinkedPRAlias(index: number): string {
  return `linked${index}`
}

export function buildReviewStatusSnapshotQuery(args: {
  linkedPullRequests: readonly { repo: GitHubRepositoryIdentity; number: number }[]
  reviewInboxRepos: readonly GitHubRepositoryIdentity[]
}): string {
  const linked = args.linkedPullRequests.slice(0, MAX_SNAPSHOT_LINKED_PRS)
  const linkedSelections = linked
    .map(
      (entry, index) =>
        `${snapshotLinkedPRAlias(index)}: repository(owner: ${JSON.stringify(
          entry.repo.owner
        )}, name: ${JSON.stringify(entry.repo.repo)}) { pullRequest(number: ${
          entry.number
        }) { ...SnapshotPR } }`
    )
    .join('\n  ')
  const inboxSearch = buildReviewInboxSearch(args.reviewInboxRepos)
  const inboxSelection = inboxSearch
    ? `inbox: search(query: ${JSON.stringify(
        inboxSearch
      )}, type: ISSUE, first: ${REVIEW_INBOX_PAGE_SIZE}) { nodes { ...SnapshotPR } }`
    : ''
  return `query {
  viewer { login }
  ${linkedSelections}
  ${inboxSelection}
}
${PR_FIELDS_FRAGMENT}`
}
