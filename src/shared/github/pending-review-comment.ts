import type { GitHubRepositoryIdentity } from './pull-request-types'
/** A review comment queued locally, not yet sent to the provider. */
export type PendingReviewComment = {
  /** Local id. Never a provider comment id — these do not exist remotely yet. */
  id: string
  path: string
  line: number
  /** Present only for a multi-line comment, and always above `line`. */
  startLine?: number
  body: string
  createdAt: number
}

export type ReviewVerdict = 'comment' | 'approve' | 'request-changes'

export type SubmitReviewVerdictRequest = {
  repoPath: string
  prNumber: number
  prRepo?: GitHubRepositoryIdentity | null
  connectionId?: string | null
  verdict: ReviewVerdict
  body: string
  comments: PendingReviewComment[]
}

export type SubmitReviewVerdictResult =
  | { ok: true; url: string; state: string }
  | { ok: false; error: string }

export type UpdatePublishedCommentRequest = {
  repoPath: string
  prRepo?: GitHubRepositoryIdentity | null
  connectionId?: string | null
  /** The comment's GraphQL node id, which locates it without an owner or a number. */
  commentNodeId: string
  body: string
}

export type UpdatePublishedCommentResult =
  | { ok: true; body: string; lastEditedAt: string | null }
  | { ok: false; error: string }

const MAX_PENDING_REVIEW_COMMENTS = 200

export function addPendingReviewComment(
  queue: readonly PendingReviewComment[],
  comment: PendingReviewComment
): PendingReviewComment[] {
  return [...queue, comment].slice(-MAX_PENDING_REVIEW_COMMENTS)
}

export function updatePendingReviewCommentBody(
  queue: readonly PendingReviewComment[],
  id: string,
  body: string
): PendingReviewComment[] {
  return queue.map((comment) => (comment.id === id ? { ...comment, body } : comment))
}

export function removePendingReviewComment(
  queue: readonly PendingReviewComment[],
  id: string
): PendingReviewComment[] {
  return queue.filter((comment) => comment.id !== id)
}

export function pendingReviewCommentsForPath(
  queue: readonly PendingReviewComment[],
  path: string
): PendingReviewComment[] {
  return queue.filter((comment) => comment.path === path)
}

/**
 * Why no verdict requires a summary: the GraphQL mutations take an optional body for
 * every event, request-changes included. REST is the one that demands a body there,
 * and this does not go through REST.
 *
 * Why approve and request-changes need nothing else: the verdict is the message. Only a
 * plain comment review has nothing to say without a summary or a single comment.
 */
export function canSubmitReviewVerdict(args: {
  verdict: ReviewVerdict
  body: string
  pendingCount: number
}): boolean {
  if (args.verdict !== 'comment') {
    return true
  }
  return args.pendingCount > 0 || !!args.body.trim()
}

function sanitizeComment(value: unknown): PendingReviewComment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw: Record<string, unknown> = { ...value }
  const { id, path, body } = raw
  const line = raw.line
  if (typeof id !== 'string' || typeof path !== 'string' || typeof body !== 'string') {
    return null
  }
  if (!id.trim() || !path.trim() || typeof line !== 'number' || !Number.isFinite(line)) {
    return null
  }
  const startLine = raw.startLine
  const createdAt = raw.createdAt
  return {
    id,
    path,
    line,
    ...(typeof startLine === 'number' && Number.isFinite(startLine) && startLine !== line
      ? { startLine }
      : {}),
    body,
    createdAt: typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0
  }
}

export function normalizePendingReviewComments(value: unknown): PendingReviewComment[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => sanitizeComment(entry) ?? []).slice(-MAX_PENDING_REVIEW_COMMENTS)
}
