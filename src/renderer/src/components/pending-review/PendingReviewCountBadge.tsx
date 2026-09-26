import React from 'react'
import { PencilLine } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { usePendingReviewQueue } from './use-pending-review-queue'

/**
 * How many review comments on this file are queued but not submitted.
 *
 * Why nothing renders at zero: the same reason the unresolved-thread badge stays hidden —
 * a row of zeroes buries the one file that still has work on it.
 */
export function PendingReviewCountBadge({
  worktreeId,
  path
}: {
  worktreeId: string | null
  path: string | undefined
}): React.JSX.Element | null {
  const { comments } = usePendingReviewQueue(worktreeId)
  const count = path ? comments.filter((comment) => comment.path === path).length : 0
  if (count === 0) {
    return null
  }
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[10px] text-status-warning"
      title={translate(
        'auto.components.pendingReview.badgeTitle',
        '{{count}} review comments waiting to be submitted',
        { count }
      )}
    >
      <PencilLine className="size-3" />
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
