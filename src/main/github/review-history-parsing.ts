import type {
  PullRequestCommitSummary,
  RawPullRequestReview
} from '../../shared/github/review-history'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function readNodes(connection: unknown): Record<string, unknown>[] {
  const nodes = asRecord(connection)?.nodes
  return Array.isArray(nodes)
    ? nodes.flatMap((node) => {
        const record = asRecord(node)
        return record ? [record] : []
      })
    : []
}

export function readCommits(connection: unknown): PullRequestCommitSummary[] {
  return readNodes(connection).flatMap((node) => {
    const commit = asRecord(node.commit)
    const oid = readString(commit?.oid)
    return oid
      ? [
          {
            oid,
            headline: readString(commit?.messageHeadline) ?? '',
            committedAt: readString(commit?.committedDate) ?? ''
          }
        ]
      : []
  })
}

export function readReviewHistory(connection: unknown): RawPullRequestReview[] {
  return readNodes(connection).flatMap((node) => {
    const login = readString(asRecord(node.author)?.login)
    const state = readString(node.state)
    return login && state
      ? [
          {
            login,
            state,
            commitOid: readString(asRecord(node.commit)?.oid),
            submittedAt: readString(node.submittedAt)
          }
        ]
      : []
  })
}
