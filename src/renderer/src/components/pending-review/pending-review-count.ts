import { useMemo } from 'react'
import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import { usePendingReviewQueue } from './use-pending-review-queue'

/** Queued comments per file, built once for a list rather than per row. */
export function buildPendingReviewCountByPath(
  comments: readonly PendingReviewComment[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const comment of comments) {
    counts.set(comment.path, (counts.get(comment.path) ?? 0) + 1)
  }
  return counts
}

/** The per-file counts for a workspace, so a list needs one hook rather than two. */
export function usePendingReviewCountByPath(worktreeId: string | null): Map<string, number> {
  const { comments } = usePendingReviewQueue(worktreeId)
  return useMemo(() => buildPendingReviewCountByPath(comments), [comments])
}
