import { useMemo } from 'react'
import { usePendingReviewQueue, type PendingReviewQueue } from './use-pending-review-queue'

export type DiffPendingReview = PendingReviewQueue & {
  /** Queue a comment against this diff's file, so callers pass only what they know. */
  queueComment: (body: string, line: number, startLine: number | undefined) => void
}

export function usePendingReviewForDiff(
  worktreeId: string | null,
  relativePath: string
): DiffPendingReview {
  const queue = usePendingReviewQueue(worktreeId)
  return useMemo(
    () => ({
      ...queue,
      queueComment: (body, line, startLine) =>
        queue.add({ path: relativePath, line, startLine, body })
    }),
    [queue, relativePath]
  )
}
