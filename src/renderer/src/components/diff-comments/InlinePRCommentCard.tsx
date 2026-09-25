import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  // Why not useState(!resolved): that reads the flag once, at mount, and the comments often arrive
  // after the zone does -- so a resolved thread stayed expanded forever. Follow the data until the
  // reader expresses a preference, then honour theirs.
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const expanded = manualExpanded ?? !resolved
  const [replyingCommentId, setReplyingCommentId] = useState<number | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  // Why a callback ref rather than useRef + an effect: the collapsed bar and the expanded card are
  // different elements, so an observer attached once keeps watching the collapsed node after it is
  // unmounted. The zone then never grows and the card paints over the code below it.
  const setContainer = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!node || typeof ResizeObserver === 'undefined') {
        return
      }
      // Why measured rather than computed: Monaco fixes a zone's height when it is inserted and
      // never re-measures, so every change of size has to push a new one in.
      const observer = new ResizeObserver(() => onContentResize())
      observer.observe(node)
      observerRef.current = observer
      onContentResize()
    },
    [onContentResize]
  )

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const handleToggle = useCallback(() => setManualExpanded(!expanded), [expanded])

  const root = getPRCommentGroupRoot(group)
  // Why flat rather than cards: the cards variant is tuned for the sidebar's narrow column, and its
  // padding and boxed replies make a zone tall enough to push the surrounding code off screen. Flat
  // gives replies a left rule instead of a box and drops the duplicated timestamps.
  const presentation = useMemo(() => {
    const flat = getPRCommentPresentationClasses('flat')
    // Why the path stops growing: flex-1 lets it eat the header row, which strands the RESOLVED
    // chip in the middle of the card instead of reading as a label on the location it describes.
    return { ...flat, pathBadge: flat.pathBadge.replace('flex-1', '') }
  }, [])
  const count = getPRCommentGroupCount(group)

  if (resolved && !expanded) {
    return (
      <div ref={setContainer} className="px-2 py-1">
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex w-full max-w-3xl items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1',
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
      <div ref={setContainer} className="px-2 py-1">
        {/* One framed block: against code, a loose stack of rows reads as part of the file. */}
        {/* Why capped: a zone spans the editor, and on a wide pane a two-line comment stretched the
            whole way reads as a banner rather than something someone said about this line. Wider
            than the saved-note card's 420px, since a thread carries replies. */}
        <div className="max-w-3xl rounded-md border border-border/70 bg-card">
          <PRCommentGroupView
            group={group}
            botAuthorOverrides={NO_BOT_OVERRIDES}
            replyingCommentId={replyingCommentId}
            onStartReply={setReplyingCommentId}
            // Why no selectionControl: the checkbox drives the panel's multi-select-for-AI list, which
            // has no meaning next to a single thread in a diff. The send menu below is the per-thread
            // equivalent.
            actionState={getPRCommentGroupActionState(group)}
            isQueued={false}
            now={now}
            presentation={presentation}
            onResolve={onResolve}
            onCancelReply={(commentId) =>
              setReplyingCommentId((current) => (current === commentId ? null : current))
            }
            onReply={onReply}
            onEditComment={onEditComment}
            onDeleteComment={onDeleteComment}
            onSetReaction={onSetReaction}
          />
          <div className="flex items-center border-t border-border/70 bg-muted/20">
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
              triggerLabel={translate(
                'auto.components.diff.comments.InlinePRCommentCard.sendHint',
                'Send to an agent'
              )}
              triggerClassName="rounded-none rounded-bl-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              iconClassName="size-3 text-muted-foreground"
              triggerAccentIcon={false}
              onDelivered={() => undefined}
            />
            {resolved ? (
              <button
                type="button"
                onClick={handleToggle}
                className="ml-auto rounded-br-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {translate(
                  'auto.components.diff.comments.InlinePRCommentCard.collapse',
                  'Collapse'
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
