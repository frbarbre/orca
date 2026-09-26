import type { PRComment } from '../../../../shared/github/comment-types'
import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import type { GitHubViewerIdentity } from './use-github-viewer'

/**
 * A queued comment shaped as the card the panel already renders.
 *
 * Why a projection rather than a second card: a draft is the same thing a posted comment
 * is — an author, a body, a line, a time — and the one difference, that it has not been
 * sent, is what the Pending badge says. The id is negative and deliberately unusable as a
 * provider id: every action on these rows is wired to the draft, never to the number.
 */
export function projectPendingReviewComment(
  comment: PendingReviewComment,
  viewer: GitHubViewerIdentity | null
): PRComment {
  return {
    id: -1,
    author: viewer?.login ?? '',
    authorAvatarUrl: viewer?.avatarUrl ?? '',
    body: comment.body,
    createdAt: new Date(comment.createdAt).toISOString(),
    url: '',
    path: comment.path,
    line: comment.line,
    ...(comment.startLine !== undefined ? { startLine: comment.startLine } : {})
  }
}
