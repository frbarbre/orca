import type { PRComment } from '../../../../shared/github/comment-types'

/**
 * Whether an inline review comment already on the pull request can be rewritten here.
 *
 * Why the provider's own answer: `viewerCanUpdate` accounts for organization and repository
 * permissions, which comparing the author's login to the viewer's cannot. The node id is
 * required as well because the edit mutation locates the comment by it.
 */
export function isEditablePublishedReviewComment(comment: PRComment): boolean {
  return Boolean(comment.threadId && comment.viewerCanUpdate && comment.reactionSubjectId)
}

/** Fork: an inline review comment already on the pull request that GitHub lets this viewer delete. */
export function isDeletablePublishedReviewComment(comment: PRComment): boolean {
  return Boolean(comment.threadId && comment.viewerCanDelete && comment.reactionSubjectId)
}

/** Fork: a submitted review's summary, which GitHub lets its author rewrite but not delete. */
export function isEditablePublishedReviewSummary(comment: PRComment): boolean {
  return Boolean(
    comment.reviewState !== undefined &&
    !comment.threadId &&
    comment.viewerCanUpdate &&
    comment.reactionSubjectId
  )
}
