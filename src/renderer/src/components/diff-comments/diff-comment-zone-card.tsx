import type React from 'react'
import type { RefObject } from 'react'
import { MessageSquareReply } from 'lucide-react'
import { earlierInThreadFromStore, revealGitHubComment } from '@/lib/agent-notes'
import { NoteThread } from './agent-note-replies-list'
import type { Root } from 'react-dom/client'
import { getDiffCommentLineLabel } from '@/lib/diff-comment-compat'
import { formatDiffCommentsForAgent as formatDiffComments } from '../../../../shared/agent-note-prompt'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { DiffCommentDeliverySnapshot } from '@/store/slices/diffComments'
import { DiffCommentCard } from './DiffCommentCard'
import { DiffCommentDraftCard } from './DiffCommentDraftCard'
import type { DecoratedDiffComment } from './decorated-diff-comment'
import { NotesSendMenu, type NotesSendMenuScope } from '../editor/NotesSendMenu'
import { translate } from '@/i18n/i18n'

export function getRenderSignature(
  comment: DecoratedDiffComment,
  formatCommentPrompt?: (comment: DecoratedDiffComment) => string
): string {
  return JSON.stringify({
    body: comment.body,
    sentAt: comment.sentAt ?? null,
    author: comment.author ?? null,
    agentName: comment.agentAuthor?.name ?? null,
    githubCommentUrl: comment.githubCommentUrl ?? null,
    threadReplies:
      comment.threadReplies?.map((reply) => [reply.id, reply.body, reply.sentAt ?? null]) ?? null,
    authorAvatarUrl: comment.authorAvatarUrl ?? null,
    createdAtLabel: comment.createdAtLabel ?? null,
    url: comment.url ?? null,
    canDelete: comment.canDelete ?? null,
    canEdit: comment.canEdit ?? null,
    sendPrompt: formatCommentPrompt ? formatCommentPrompt(comment) : null
  })
}

// Fork: the user's unsent messages in this note's thread — the note itself and any follow-ups.
function unsentThreadNotes(comment: DecoratedDiffComment): DecoratedDiffComment[] {
  const own = comment.agentAuthor || comment.sentAt ? [] : [comment]
  const followUps = (comment.threadReplies ?? []).filter(
    (reply) => !reply.agentAuthor && !reply.sentAt
  )
  return [...own, ...followUps]
}

function getSingleCommentSendScopes(
  comment: DecoratedDiffComment,
  worktreeId: string,
  formatCommentPrompt?: (comment: DecoratedDiffComment) => string
): NotesSendMenuScope<DecoratedDiffComment>[] {
  const notes = unsentThreadNotes(comment)
  return [
    {
      id: 'note',
      label: translate(
        'auto.components.diff.comments.useDiffCommentDecorator.995fa28b50',
        'This note'
      ),
      notes,
      formatPrompt: () =>
        formatCommentPrompt
          ? formatCommentPrompt(comment)
          : formatDiffComments(notes, earlierInThreadFromStore(worktreeId))
    }
  ]
}

function AgentNoteGitHubLink({ url }: { url: string }): React.JSX.Element {
  const label = translate(
    'auto.components.diff.comments.AgentNoteGitHubLink.label',
    'Show the GitHub comment'
  )
  return (
    <button
      type="button"
      className="orca-diff-comment-pill-btn"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        revealGitHubComment(url)
      }}
    >
      <MessageSquareReply className="size-3" />
    </button>
  )
}

// Callbacks arrive as refs so the rendered props keep the decorator's identity semantics.
export type DiffCommentZoneCardContext = {
  worktreeId: string
  filePath: string
  activeGroupId: string
  formatCommentPrompt?: (comment: DecoratedDiffComment) => string
  resizeZone: (commentId: string) => void
  onDeleteCommentRef: RefObject<(commentId: string) => void>
  onUpdateCommentRef: RefObject<((commentId: string, body: string) => Promise<boolean>) | undefined>
  clearDeliveredDiffComments: (
    worktreeId: string,
    comments: readonly DiffCommentDeliverySnapshot[]
  ) => Promise<boolean>
}

export function renderDiffCommentZoneCard(
  root: Root,
  comment: DecoratedDiffComment,
  {
    worktreeId,
    filePath,
    activeGroupId,
    formatCommentPrompt,
    resizeZone,
    onDeleteCommentRef,
    onUpdateCommentRef,
    clearDeliveredDiffComments
  }: DiffCommentZoneCardContext
): void {
  const agentName = comment.agentAuthor?.name
  root.render(
    // View zones are separate React roots outside the app root, so App.tsx context providers don't reach them.
    <TooltipProvider delayDuration={400}>
      <DiffCommentCard
        lineNumber={comment.lineNumber}
        startLine={comment.startLine}
        label={comment.author ? getDiffCommentLineLabel(comment).toLowerCase() : undefined}
        body={comment.body}
        sentAt={comment.sentAt}
        author={comment.author}
        agentName={agentName}
        createdAtLabel={comment.createdAtLabel}
        url={comment.url}
        onDelete={
          comment.canDelete === false ? undefined : () => onDeleteCommentRef.current(comment.id)
        }
        onSubmitEdit={
          onUpdateCommentRef.current && comment.canEdit !== false && !agentName
            ? async (body) => {
                const fn = onUpdateCommentRef.current
                if (!fn) {
                  return false
                }
                return fn(comment.id, body)
              }
            : undefined
        }
        onContentResize={() => resizeZone(comment.id)}
        observeRenderedSize
        footer={
          worktreeId && comment.author === undefined ? (
            <NoteThread
              root={comment}
              replies={comment.threadReplies ?? []}
              worktreeId={worktreeId}
              onDelete={(noteId) => onDeleteCommentRef.current(noteId)}
            />
          ) : undefined
        }
        headerActions={
          <>
            {agentName && comment.githubCommentUrl ? (
              <AgentNoteGitHubLink url={comment.githubCommentUrl} />
            ) : null}
            {worktreeId &&
            comment.author === undefined &&
            (!agentName || unsentThreadNotes(comment).length > 0) ? (
              <NotesSendMenu
                worktreeId={worktreeId}
                groupId={activeGroupId}
                modeIdParts={['diff-comment-note', worktreeId, filePath, comment.id]}
                scopes={getSingleCommentSendScopes(comment, worktreeId, formatCommentPrompt)}
                targetModeLabel="This note"
                triggerClassName="orca-diff-comment-edit"
                disabledTooltip="Note already sent"
                focusRequestKey={comment.id}
                onDelivered={(notes) => void clearDeliveredDiffComments(worktreeId, notes)}
              />
            ) : null}
          </>
        }
      />
    </TooltipProvider>
  )
}

export type DiffCommentDraftCardContext = {
  placeholder?: string
  submitLabel?: string
  submittingLabel?: string
  initialBody?: string
  onBodyChange?: (body: string) => void
  resizeZone: () => void
  onCancel: () => void
  onSubmit: (body: string) => Promise<boolean>
}

export function renderDiffCommentDraftCard(
  root: Root,
  draft: { lineNumber: number; startLine?: number },
  {
    placeholder,
    submitLabel,
    submittingLabel,
    initialBody,
    onBodyChange,
    resizeZone,
    onCancel,
    onSubmit
  }: DiffCommentDraftCardContext
): void {
  root.render(
    <TooltipProvider delayDuration={400}>
      <DiffCommentDraftCard
        lineNumber={draft.lineNumber}
        startLine={draft.startLine}
        placeholder={placeholder}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        initialBody={initialBody}
        onBodyChange={onBodyChange}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onContentResize={resizeZone}
      />
    </TooltipProvider>
  )
}
