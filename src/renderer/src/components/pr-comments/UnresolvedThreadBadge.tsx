import React from 'react'
import { MessageSquare } from 'lucide-react'
import { usePRCommentScope } from './use-pr-comment-scope'
import { countUnresolvedThreadsForPath } from './unresolved-thread-count'
import { translate } from '@/i18n/i18n'

/**
 * How many review threads on this file are still open, shown on its tab.
 *
 * Why nothing renders at zero: a reviewer scans the tab strip for what is left to answer, and a row
 * of zeroes is noise that hides the one file that needs them.
 */
export function UnresolvedThreadBadge({
  worktreeId,
  path
}: {
  worktreeId: string | null
  path: string | undefined
}): React.JSX.Element | null {
  const { groups } = usePRCommentScope(worktreeId)
  const count = countUnresolvedThreadsForPath(groups, path ?? '')
  if (count === 0) {
    return null
  }
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[10px] text-muted-foreground"
      title={translate(
        'auto.components.pr.comments.UnresolvedThreadBadge.title',
        '{{count}} unresolved review threads',
        { count }
      )}
    >
      <MessageSquare className="size-3" />
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
