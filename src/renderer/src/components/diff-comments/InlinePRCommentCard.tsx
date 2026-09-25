import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { getPRCommentGroupActionState } from '@/lib/pr-comment-action-state'
import { getPRCommentPresentationClasses } from '@/components/right-sidebar/pr-comment-presentation'
import { PRCommentGroupView } from '@/components/right-sidebar/checks-panel/comment-group'
import { NotesSendMenu } from '@/components/editor/NotesSendMenu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import {
  getPRCommentGroupCount,
  getPRCommentGroupId,
  getPRCommentGroupRoot,
  type PRCommentGroup
} from '../../../../shared/pr-comment-groups'
import type { GitHubReactionContent, PRComment } from '../../../../shared/github/comment-types'
import type { RightPanelCommentSubmitResult } from '@/components/right-sidebar/right-panel-comment-composer'

const NO_BOT_OVERRIDES: ReadonlySet<string> = new Set()

function formatThreadPrompt(group: PRCommentGroup, relativePath: string): string {
  const root = getPRCommentGroupRoot(group)
  const replies = group.kind === 'thread' ? group.replies : []
  const lines = [
    `Address this pull request review comment on ${relativePath}:${root.line ?? '?'}.`,
    '',
    `@${root.author}: ${root.body}`,
    ...replies.map((reply) => `@${reply.author}: ${reply.body}`)
  ]
  return lines.join('\n')
}

export type InlinePRCommentCardProps = {
  group: PRCommentGroup
  resolved: boolean
  relativePath: string
  worktreeId: string
  now: number
  onContentResize: () => void
  onResolve: (threadId: string, resolve: boolean) => boolean | Promise<boolean>
  onReply: (comment: PRComment, body: string) => Promise<RightPanelCommentSubmitResult>
  onEditComment: (comment: PRComment, body: string) => Promise<boolean>
  onDeleteComment: (comment: PRComment) => void | Promise<void>
  onSetReaction: (
    comment: PRComment,
    content: GitHubReactionContent,
    reacted: boolean
  ) => Promise<boolean>
}

/**
 * One review thread, rendered in a Monaco view zone on the line it was left on.
 *
 * Why resolved threads start collapsed: a reviewed file can carry a long tail of settled
 * conversation, and pushing the code apart for each one buries what is still open. Expanding shows
 * the card in its resolved form rather than a different, "reopened"-looking one.
 */
export function InlinePRCommentCard({
  group,
  resolved,
  relativePath,
  worktreeId,
  now,
  onContentResize,
  onResolve,
  onReply,
  onEditComment,
  onDeleteComment,
  onSetReaction
}: InlinePRCommentCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(!resolved)
  const [replyingCommentId, setReplyingCommentId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Why observed rather than measured once: Monaco fixes a zone's height when it is inserted, so a
  // card that grows (a reply box opening, an expand) would otherwise be clipped by the next line.
  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => onContentResize())
    observer.observe(node)
    return () => observer.disconnect()
  }, [onContentResize])

  const handleToggle = useCallback(() => setExpanded((value) => !value), [])

  const root = getPRCommentGroupRoot(group)
  const presentation = getPRCommentPresentationClasses('cards')
  const count = getPRCommentGroupCount(group)

  if (resolved && !expanded) {
    return (
      <div ref={containerRef} className="px-2 py-1">
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1',
            'text-left text-[11px] text-muted-foreground hover:bg-muted/70'
          )}
        >
          <MessageSquare className="size-3 shrink-0" />
          <span className="truncate">
            {translate(
              'auto.components.diff.comments.InlinePRCommentCard.resolvedThread',
              'Resolved · {{author}}: {{body}}',
              { author: root.author, body: root.body }
            )}
          </span>
          <span className="ml-auto shrink-0 tabular-nums">{count}</span>
        </button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div ref={containerRef} className="px-2 py-1">
        <PRCommentGroupView
          group={group}
          botAuthorOverrides={NO_BOT_OVERRIDES}
          replyingCommentId={replyingCommentId}
          // Why no selectionControl: the checkbox drives the panel's multi-select-for-AI list, which
          // has no meaning next to a single thread in a diff. The send menu below is the per-thread
          // equivalent.
          actionState={getPRCommentGroupActionState(group)}
          isQueued={false}
          now={now}
          presentation={presentation}
          onResolve={onResolve}
          onStartReply={setReplyingCommentId}
          onCancelReply={(commentId) =>
            setReplyingCommentId((current) => (current === commentId ? null : current))
          }
          onReply={onReply}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          onSetReaction={onSetReaction}
        />
        <div className="mt-1 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1">
          <NotesSendMenu<PRComment>
            worktreeId={worktreeId}
            groupId={getPRCommentGroupId(group)}
            modeIdParts={['pr-review-comment', worktreeId, relativePath, String(root.id)]}
            scopes={[
              {
                id: 'thread',
                label: translate(
                  'auto.components.diff.comments.InlinePRCommentCard.thisThread',
                  'This comment'
                ),
                notes: [root],
                prompt: formatThreadPrompt(group, relativePath)
              }
            ]}
            targetModeLabel={translate(
              'auto.components.diff.comments.InlinePRCommentCard.thisThread',
              'This comment'
            )}
            onDelivered={() => undefined}
          />
          <span className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.diff.comments.InlinePRCommentCard.sendHint',
              'Send to an agent'
            )}
          </span>
          {resolved ? (
            <button
              type="button"
              onClick={handleToggle}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
            >
              {translate('auto.components.diff.comments.InlinePRCommentCard.collapse', 'Collapse')}
            </button>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}
