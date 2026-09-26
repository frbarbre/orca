import React, { useEffect, useState } from 'react'
import { CommentRow } from '@/components/right-sidebar/checks-panel/comment-row'
import { getPRCommentPresentationClasses } from '@/components/right-sidebar/pr-comment-presentation'
import { cn } from '@/lib/utils'
import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import { projectPendingReviewComment } from './pending-review-comment-projection'
import { useGitHubViewer } from './use-github-viewer'

const NO_BOT_AUTHORS: ReadonlySet<string> = new Set()

/**
 * A queued review comment, rendered as the same card a posted one uses.
 *
 * Why the shared row rather than a card of its own: a draft carries the same author,
 * body, line and time, and showing it differently would make the queue read as a
 * separate kind of thing. Only the Pending badge and the absence of resolve, reply and
 * reactions mark it as unsent.
 */
export function PendingReviewCommentCard({
  comment,
  onChangeBody,
  onRemove,
  inDiff = false,
  onContentResize
}: {
  comment: PendingReviewComment
  onChangeBody: (body: string) => void
  onRemove: () => void
  /** In a diff the card is framed and capped, the way a posted thread is. */
  inDiff?: boolean
  /** A Monaco view zone fixes its height at insertion, so it has to be told to grow. */
  onContentResize?: () => void
}): React.JSX.Element {
  const viewer = useGitHubViewer()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  // Why frozen at mount: a draft is minutes old at most, and reading the clock during
  // render makes the row re-render unpredictably.
  const [now] = useState(() => Date.now())
  // Why the same overrides a posted thread uses: the two sit on the same line of the same
  // file and must read as one kind of thing. The group surface goes bare because the frame
  // below already draws the border; two a few pixels apart read as a rendering fault.
  const base = getPRCommentPresentationClasses()
  const presentation = {
    ...base,
    // Why the group surface goes bare: the frame below already draws the border, and two
    // a few pixels apart read as a rendering fault rather than as structure.
    group: 'overflow-clip',
    pathBadge: base.pathBadge.replace('flex-1', ''),
    // Why the file name only shows outside the diff: in the diff the card is open inside
    // that file, so repeating it spends the header on something already on screen.
    ...(inDiff ? { pathBadgeShowsFile: false } : {})
  }

  useEffect(() => {
    if (!container || !onContentResize) {
      return
    }
    const observer = new ResizeObserver(() => onContentResize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [container, onContentResize])

  return (
    <div ref={setContainer} className={cn(inDiff && 'px-2 py-1')}>
      <div className={cn('rounded-md border border-border/70 bg-card', inDiff && 'max-w-3xl')}>
        <CommentRow
          comment={projectPendingReviewComment(comment, viewer)}
          botAuthorOverrides={NO_BOT_AUTHORS}
          isReply={false}
          showResolve={false}
          showReply={false}
          actionState="pending"
          isQueued={false}
          presentation={presentation}
          now={now}
          forceMutable
          onEditComment={async (_comment, body) => {
            onChangeBody(body)
            return true
          }}
          onDeleteComment={() => onRemove()}
        />
      </div>
    </div>
  )
}
