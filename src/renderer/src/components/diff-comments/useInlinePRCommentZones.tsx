import { useEffect, useRef } from 'react'
import type { editor as monacoEditor } from 'monaco-editor'
import { createRoot, type Root } from 'react-dom/client'
import { installDiffCommentZoneMouseDownStopper } from './diff-comment-zone-mouse-events'
import { resizeDiffCommentZone, type ZoneEntry } from './diff-comment-view-zone-entry'
import { selectInlinePRCommentPlacements } from './inline-pr-comment-placement'
import { PendingReviewCommentCard } from '@/components/pending-review/PendingReviewCommentCard'
import type { PendingReviewQueue } from '@/components/pending-review/use-pending-review-queue'
import { InlinePRCommentCard } from './InlinePRCommentCard'
import type { PRCommentGroup } from '../../../../shared/pr-comment-groups'
import type { GitHubReactionContent, PRComment } from '../../../../shared/github/comment-types'
import type { RightPanelCommentSubmitResult } from '@/components/right-sidebar/right-panel-comment-composer'

// Why an estimate at all: Monaco fixes heightInPx when a zone is inserted and never re-measures on
// its own, so the zone starts roughly card-sized and the card's ResizeObserver corrects it.
const INITIAL_ZONE_PX = 132
const RESOLVED_ZONE_PX = 34
const PENDING_ZONE_PX = 108

export type InlinePRCommentZoneHandlers = {
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
 * Renders PR review threads into Monaco view zones on the lines they belong to.
 *
 * Why zones rather than the overlay the add-comment popover uses: a zone displaces the code below
 * it, so a card never covers the lines around the one being discussed. It is the same mechanism
 * Orca's own diff notes already use.
 */
export function useInlinePRCommentZones({
  editor,
  modelKey,
  groups,
  relativePath,
  worktreeId,
  handlers,
  pendingReview
}: {
  editor: monacoEditor.ICodeEditor | null
  modelKey: string | null
  groups: readonly PRCommentGroup[]
  relativePath: string
  worktreeId: string
  handlers: InlinePRCommentZoneHandlers
  pendingReview: PendingReviewQueue
}): void {
  // Why refs: the handlers are rebuilt every render, and re-running the zone effect on that would
  // tear down and re-add every zone on each keystroke in a reply box.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const pendingRef = useRef(pendingReview)
  pendingRef.current = pendingReview
  const zonesRef = useRef(new Map<string, ZoneEntry>())

  useEffect(() => {
    const zones = zonesRef.current
    if (!editor) {
      return
    }
    const model = editor.getModel()
    if (!model) {
      return
    }
    const placements = selectInlinePRCommentPlacements(
      groups,
      relativePath,
      model.getLineCount(),
      pendingReview.comments
    )
    const wanted = new Map(placements.map((placement) => [placement.id, placement]))
    const rootsToUnmount: Root[] = []

    const renderZone = (id: string): void => {
      const entry = zones.get(id)
      const placement = wanted.get(id)
      if (!entry || !placement) {
        return
      }
      if (placement.kind === 'pending') {
        entry.root.render(
          <PendingReviewCommentCard
            comment={placement.comment}
            onChangeBody={(body) => pendingRef.current.updateBody(placement.comment.id, body)}
            onRemove={() => pendingRef.current.remove(placement.comment.id)}
            onContentResize={() => resizeDiffCommentZone(editor, entry)}
          />
        )
        return
      }
      entry.root.render(
        <InlinePRCommentCard
          group={placement.group}
          resolved={placement.resolved}
          relativePath={relativePath}
          worktreeId={worktreeId}
          now={Date.now()}
          onContentResize={() => resizeDiffCommentZone(editor, entry)}
          onResolve={(threadId, resolve) => handlersRef.current.onResolve(threadId, resolve)}
          onReply={(comment, body) => handlersRef.current.onReply(comment, body)}
          onEditComment={(comment, body) => handlersRef.current.onEditComment(comment, body)}
          onDeleteComment={(comment) => handlersRef.current.onDeleteComment(comment)}
          onSetReaction={(comment, content, reacted) =>
            handlersRef.current.onSetReaction(comment, content, reacted)
          }
        />
      )
    }

    editor.changeViewZones((accessor) => {
      // Remove only what is gone, so an open reply box on an untouched thread keeps its focus.
      for (const [id, entry] of zones) {
        if (!wanted.has(id)) {
          accessor.removeZone(entry.zoneId)
          entry.disposeMouseDownStopper()
          rootsToUnmount.push(entry.root)
          zones.delete(id)
        }
      }

      for (const placement of placements) {
        const existing = zones.get(placement.id)
        const signature =
          placement.kind === 'pending'
            ? `${placement.lineNumber}:pending:${placement.comment.body}`
            : `${placement.lineNumber}:${placement.resolved}`
        if (existing) {
          if (existing.lastRenderSignature !== signature) {
            existing.lastRenderSignature = signature
            renderZone(placement.id)
          }
          continue
        }
        const dom = document.createElement('div')
        dom.className = 'orca-inline-pr-comment'
        // Swallow mousedown so clicking the card does not move the editor's cursor or start a drag.
        const stopMouseDown = installDiffCommentZoneMouseDownStopper(dom)

        // Why pinned: a view zone lives in the scrolling content layer and inherits the *content*
        // width, which long code lines make far wider than the pane. The card was rendering past
        // the right edge with its text cut off, and sliding away when the diff scrolled sideways.
        // Match the visible width and cancel the horizontal scroll so it stays put.
        const pinHorizontally = (): void => {
          dom.style.width = `${editor.getLayoutInfo().contentWidth}px`
          dom.style.transform = `translateX(${editor.getScrollLeft()}px)`
        }
        pinHorizontally()
        const scrollSub = editor.onDidScrollChange(pinHorizontally)
        const layoutSub = editor.onDidLayoutChange(pinHorizontally)
        const disposeMouseDownStopper = (): void => {
          stopMouseDown()
          scrollSub.dispose()
          layoutSub.dispose()
        }
        const root = createRoot(dom)
        const delegate: monacoEditor.IViewZone = {
          afterLineNumber: placement.lineNumber,
          heightInPx:
            placement.kind === 'pending'
              ? PENDING_ZONE_PX
              : placement.resolved
                ? RESOLVED_ZONE_PX
                : INITIAL_ZONE_PX,
          domNode: dom,
          suppressMouseDown: false
        }
        const zoneId = accessor.addZone(delegate)
        zones.set(placement.id, {
          zoneId,
          domNode: dom,
          delegate,
          root,
          disposeMouseDownStopper,
          lastRenderSignature: signature,
          laidOut: false
        })
      }
    })

    for (const placement of placements) {
      renderZone(placement.id)
    }
    // Why deferred: unmounting a root inside changeViewZones races Monaco's own zone bookkeeping.
    if (rootsToUnmount.length > 0) {
      queueMicrotask(() => {
        for (const root of rootsToUnmount) {
          root.unmount()
        }
      })
    }
  }, [editor, groups, modelKey, pendingReview.comments, relativePath, worktreeId])

  // Tear every zone down when the viewer goes away, so a reused editor does not inherit them.
  useEffect(() => {
    const zones = zonesRef.current
    return () => {
      const entries = [...zones.values()]
      zones.clear()
      for (const entry of entries) {
        entry.disposeMouseDownStopper()
      }
      queueMicrotask(() => {
        for (const entry of entries) {
          entry.root.unmount()
        }
      })
    }
  }, [])
}
