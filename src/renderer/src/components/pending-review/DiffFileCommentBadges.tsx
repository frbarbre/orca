import React from 'react'
import { UnresolvedThreadBadge } from '@/components/pr-comments/UnresolvedThreadBadge'
import { PendingReviewCountBadge } from './PendingReviewCountBadge'

/** What a diff tab says about its comments: unresolved threads, then unsent drafts. */
export function DiffFileCommentBadges({
  worktreeId,
  path
}: {
  worktreeId: string | null
  path: string | undefined
}): React.JSX.Element {
  return (
    <>
      <UnresolvedThreadBadge worktreeId={worktreeId} path={path} />
      <PendingReviewCountBadge worktreeId={worktreeId} path={path} />
    </>
  )
}
