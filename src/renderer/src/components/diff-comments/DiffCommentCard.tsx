import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  MessageSquare,
  Pencil,
  Trash
} from 'lucide-react'
import { Composer } from '@/components/composer/Composer'
import { CopyMessageButton } from './copy-message-button'
import { AgentNoteIcon } from './agent-note-icon'
import { isDiffNoteCollapsed, setDiffNoteCollapsed } from './collapsed-diff-notes'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { getDiffCommentLineLabel } from '@/lib/diff-comment-compat'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'

// Render note cards in per-zone React roots; keep persisted DiffComment names while UI says Note to distinguish PR review comments.

type Props = {
  lineNumber: number
  startLine?: number
  label?: string | null
  quote?: string
  body: string
  sentAt?: number
  author?: string
  /** Fork: names the agent that left this note; the card then reads as a bot note. */
  agentName?: string
  createdAtLabel?: string
  url?: string
  onDelete?: () => void
  // Monaco zones do not auto-measure; notify the decorator when wrapping/growth needs a new heightInPx.
  onContentResize?: () => void
  observeRenderedSize?: boolean
  onSubmitEdit?: (body: string) => Promise<boolean>
  headerActions?: ReactNode
  footer?: ReactNode
  collapseId?: string
  replyCount?: number
}

export function DiffCommentCard({
  lineNumber,
  startLine,
  label,
  quote,
  body,
  sentAt,
  author,
  agentName,
  createdAtLabel,
  url,
  onDelete,
  onContentResize,
  observeRenderedSize,
  onSubmitEdit,
  headerActions,
  footer,
  collapseId,
  replyCount = 0
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(() =>
    collapseId ? isDiffNoteCollapsed(collapseId) : false
  )
  const [draft, setDraft] = useState(body)
  const [submitting, setSubmitting] = useState(false)
  const mountedRef = useMountedRef()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const editHeightRef = useRef<number | null>(null)
  const resizeAfterCloseRef = useRef(false)
  const observesRenderedSize = observeRenderedSize === true && onContentResize !== undefined

  // Read the latest resize callback without rerunning edit layout; fresh parent arrows would move the caret to the end mid-edit.
  const onContentResizeRef = useRef(onContentResize)
  onContentResizeRef.current = onContentResize

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card || !observesRenderedSize) {
      return
    }
    onContentResizeRef.current?.()
    let frameId: number | null = null
    const notifyResize = (): void => {
      if (frameId !== null) {
        return
      }
      frameId = requestAnimationFrame(() => {
        frameId = null
        onContentResizeRef.current?.()
      })
    }
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      }
    }
    // Initial Monaco estimates miss narrow-pane wrapping; observe actual card height in both diff layouts.
    const observer = new ResizeObserver(() => notifyResize())
    observer.observe(card)
    return () => {
      observer.disconnect()
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [observesRenderedSize])

  useLayoutEffect(() => {
    if (!editing) {
      editHeightRef.current = null
      if (resizeAfterCloseRef.current) {
        resizeAfterCloseRef.current = false
        onContentResizeRef.current?.()
      }
      return
    }
    onContentResizeRef.current?.()
  }, [editing])

  const scheduleContentResizeAfterClose = (): void => {
    // Measure after the body-only commit; async saves must not retain the textarea/footer height.
    resizeAfterCloseRef.current = true
  }

  const handleStartEdit = (): void => {
    setDraft(body)
    setEditing(true)
  }

  const handleCancel = (): void => {
    scheduleContentResizeAfterClose()
    setEditing(false)
    setDraft(body)
  }

  const handleToggleCollapsed = (): void => {
    if (!collapseId) {
      return
    }
    setDiffNoteCollapsed(collapseId, !collapsed)
    setCollapsed(!collapsed)
  }

  const trimmedDraft = draft.trim()
  const canSubmit = !submitting && trimmedDraft.length > 0 && trimmedDraft !== body
  const lineLabel =
    label === undefined ? getDiffCommentLineLabel({ lineNumber, startLine }).toLowerCase() : label
  const metaText = [
    agentName ? null : author || 'Note',
    lineLabel,
    createdAtLabel || (sentAt ? 'sent' : null)
  ]
    .filter(Boolean)
    .join(' ')

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit || !onSubmitEdit) {
      return
    }
    setSubmitting(true)
    try {
      const ok = await onSubmitEdit(trimmedDraft)
      if (ok && mountedRef.current) {
        scheduleContentResizeAfterClose()
        setEditing(false)
      }
    } catch (err) {
      // Catch rejected saves and retain the draft for retry; fire-and-forget callers cannot handle this rejection.
      console.error('Failed to submit diff comment edit:', err)
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  return (
    <div
      ref={cardRef}
      className="orca-diff-comment-card"
      data-agent-note={agentName ? 'true' : undefined}
    >
      <div className="orca-diff-comment-content-col">
        {/* Header Row */}
        <div className="orca-diff-comment-header">
          <div className="orca-diff-comment-meta-group">
            {collapseId && !editing && (
              <button
                type="button"
                className="orca-diff-comment-pill-btn"
                aria-expanded={!collapsed}
                aria-label={
                  collapsed
                    ? translate(
                        'auto.components.diff.comments.DiffCommentCard.expandNote',
                        'Expand note'
                      )
                    : translate(
                        'auto.components.diff.comments.DiffCommentCard.collapseNote',
                        'Collapse note'
                      )
                }
                onMouseDown={(ev) => ev.stopPropagation()}
                onClick={(ev) => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  handleToggleCollapsed()
                }}
              >
                {collapsed ? (
                  <ChevronRight className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>
            )}
            {agentName && (
              <>
                <AgentNoteIcon name={agentName} />
                <span className="orca-diff-comment-agent-name">{agentName}</span>
                <span className="orca-diff-comment-agent-badge">
                  {translate(
                    'auto.components.diff.comments.DiffCommentCard.agentNote',
                    'Agent note'
                  )}
                </span>{' '}
              </>
            )}
            {metaText}
          </div>

          {/* Action buttons pill (only shown if not editing) */}
          {!editing && (
            <div
              className="orca-diff-comment-actions-pill"
              onMouseDown={(ev) => ev.stopPropagation()}
            >
              {headerActions}
              {headerActions && <span className="orca-diff-comment-pill-divider" />}
              <CopyMessageButton text={body} />
              {(url || onSubmitEdit || onDelete) && (
                <span className="orca-diff-comment-pill-divider" />
              )}
              {url && (
                <>
                  <button
                    type="button"
                    className="orca-diff-comment-pill-btn"
                    title={translate(
                      'auto.components.diff.comments.DiffCommentCard.508ee678a5',
                      'Open in browser'
                    )}
                    aria-label={translate(
                      'auto.components.diff.comments.DiffCommentCard.508ee678a5',
                      'Open in browser'
                    )}
                    onClick={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      void window.api.shell.openUrl(url)
                    }}
                  >
                    {translate('auto.components.diff.comments.DiffCommentCard.6978871a3d', 'Open')}
                  </button>
                  {(onSubmitEdit || onDelete) && (
                    <span className="orca-diff-comment-pill-divider" />
                  )}
                </>
              )}
              {onSubmitEdit && (
                <>
                  <button
                    type="button"
                    className="orca-diff-comment-pill-btn"
                    title={translate(
                      'auto.components.diff.comments.DiffCommentCard.cad3384faa',
                      'Edit note'
                    )}
                    aria-label={translate(
                      'auto.components.diff.comments.DiffCommentCard.cad3384faa',
                      'Edit note'
                    )}
                    onClick={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      handleStartEdit()
                    }}
                  >
                    <Pencil className="size-3" />
                  </button>
                  {onDelete && <span className="orca-diff-comment-pill-divider" />}
                </>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="orca-diff-comment-pill-btn orca-diff-comment-pill-btn-danger"
                  title={translate(
                    'auto.components.diff.comments.DiffCommentCard.cce596969e',
                    'Delete note'
                  )}
                  aria-label={translate(
                    'auto.components.diff.comments.DiffCommentCard.cce596969e',
                    'Delete note'
                  )}
                  onClick={(ev) => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {collapsed && !editing ? (
          <button
            type="button"
            data-note-collapsed-summary=""
            className="flex w-full min-w-0 items-center gap-2 text-left text-[11px] text-muted-foreground hover:text-foreground"
            onMouseDown={(ev) => ev.stopPropagation()}
            onClick={handleToggleCollapsed}
          >
            <span className="min-w-0 truncate">{body}</span>
            {replyCount > 0 ? (
              <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
                <MessageSquare className="size-3" />
                {replyCount}
              </span>
            ) : null}
          </button>
        ) : null}

        {/* Quote Block */}
        {quote && !collapsed ? (
          <div className="orca-diff-comment-quote">
            <div className="orca-diff-comment-quote-text">{quote}</div>
          </div>
        ) : null}

        {/* Body or Edit Mode */}
        {editing ? (
          <div className="flex flex-col gap-2 mt-1">
            <Composer
              context="agent"
              value={draft}
              onChange={setDraft}
              placeholder={translate(
                'auto.components.diff.comments.DiffCommentPopover.f6c449191e',
                'Add note for the AI'
              )}
              autoFocus
              onCancel={handleCancel}
              onSubmit={() => {
                if (canSubmit) {
                  void handleSubmit()
                }
              }}
              onHeightChange={(height) => {
                // Why: rich-review layout measures every note; skip it when this card stayed put.
                if (height !== editHeightRef.current) {
                  editHeightRef.current = height
                  onContentResizeRef.current?.()
                }
              }}
            />
            <div className="orca-diff-comment-popover-footer">
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={submitting}>
                {translate('auto.components.diff.comments.DiffCommentCard.0203bed775', 'Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                title={
                  submitting
                    ? translate(
                        'auto.components.diff.comments.DiffCommentCard.bb0a55f856',
                        'Saving…'
                      )
                    : undefined
                }
              >
                {translate('auto.components.diff.comments.DiffCommentCard.109a791e7b', 'Save')}
                <CornerDownLeft className="ml-1 size-3 opacity-70" />
              </Button>
            </div>
          </div>
        ) : collapsed ? null : agentName ? (
          // Fork: agents write their notes in markdown; the user's own notes stay the text they typed.
          <CommentMarkdown
            content={body}
            variant="compact"
            className="orca-diff-comment-body orca-diff-comment-body-markdown"
          />
        ) : (
          <div className="orca-diff-comment-body">{body}</div>
        )}
        {collapsed ? null : footer}
      </div>
    </div>
  )
}
