import type { PRComment } from '../../../../../shared/github/comment-types'

// Fork: the PR panel lists resolved threads in their own section, so Comments neither shows nor
// counts them; a reply inherits its thread's state through the shared thread id.
export function withoutResolvedThreads(comments: readonly PRComment[]): PRComment[] {
  const resolvedThreadIds = new Set(
    comments.flatMap((comment) =>
      comment.isResolved === true && comment.threadId ? [comment.threadId] : []
    )
  )
  return comments.filter(
    (comment) => !(comment.threadId && resolvedThreadIds.has(comment.threadId))
  )
}
