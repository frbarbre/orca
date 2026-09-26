import type {
  PendingReviewComment,
  ReviewVerdict
} from '../../shared/github/pending-review-comment'

const EVENT_BY_VERDICT: Record<ReviewVerdict, string> = {
  comment: 'COMMENT',
  approve: 'APPROVE',
  'request-changes': 'REQUEST_CHANGES'
}

function threadLiteral(comment: PendingReviewComment): string {
  const fields = [
    `path: ${JSON.stringify(comment.path)}`,
    `line: ${comment.line}`,
    'side: RIGHT',
    `body: ${JSON.stringify(comment.body)}`
  ]
  // Why omitted when equal: a single-line comment must not declare a range, which
  // the provider rejects.
  if (typeof comment.startLine === 'number' && comment.startLine !== comment.line) {
    fields.splice(2, 0, `startLine: ${comment.startLine}`, 'startSide: RIGHT')
  }
  return `{ ${fields.join(', ')} }`
}

/**
 * Why the input is a literal rather than GraphQL variables: `gh api -f` sends strings
 * only, so a nested thread array cannot be passed that way, and the gh runner never
 * forwards `options.stdin`, so `--input -` would send an empty body.
 */
export function buildReviewVerdictMutation(args: {
  pullRequestId: string
  verdict: ReviewVerdict
  body: string
  comments: readonly PendingReviewComment[]
}): string {
  const threads = args.comments.map(threadLiteral).join(', ')
  const input = [
    `pullRequestId: ${JSON.stringify(args.pullRequestId)}`,
    `event: ${EVENT_BY_VERDICT[args.verdict]}`,
    `body: ${JSON.stringify(args.body)}`,
    ...(args.comments.length > 0 ? [`threads: [${threads}]`] : [])
  ].join(', ')
  return `mutation { addPullRequestReview(input: { ${input} }) { pullRequestReview { id state url } } }`
}

export function buildPullRequestNodeIdQuery(args: {
  owner: string
  repo: string
  number: number
}): string {
  // viewerDidAuthor rides along because the provider refuses an approve or a
  // request-changes on your own pull request, and the UI should say so before the click.
  return `query { repository(owner: ${JSON.stringify(args.owner)}, name: ${JSON.stringify(
    args.repo
  )}) { pullRequest(number: ${args.number}) { id viewerDidAuthor viewerLatestReview { state } } } }`
}
