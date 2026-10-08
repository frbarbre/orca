import React, { useState } from 'react'
import { CornerDownLeft, MessageSquareReply, Trash, User } from 'lucide-react'
import { AgentNoteIcon } from './agent-note-icon'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { ImeTextarea } from '@/lib/ime-text-field'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'

const MAX_REPLY_HEIGHT_PX = 240

function fitToContent(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_REPLY_HEIGHT_PX)}px`
}

// Fork: the replies under a note (the user's and agents'), and a box to add one.
export function NoteThread({
  root,
  replies,
  worktreeId,
  onDelete
}: {
  root: DiffComment
  replies: readonly DiffComment[]
  worktreeId: string
  onDelete: (noteId: string) => void
}): React.JSX.Element {
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const deleteLabel = translate(
    'auto.components.diff.comments.AgentNoteReplies.delete',
    'Delete reply'
  )
  const replyLabel = translate('auto.components.diff.comments.NoteThread.reply', 'Reply')
  const addLabel = translate('auto.components.diff.comments.NoteThread.add', 'Add reply')
  const youLabel = translate('auto.components.diff.comments.NoteThread.you', 'You')

  const submit = async (): Promise<void> => {
    const body = draft.trim()
    if (!body || saving) {
      return
    }
    setSaving(true)
    const saved = await useAppStore.getState().addDiffComment({
      worktreeId,
      filePath: root.filePath,
      ...(root.startLine !== undefined ? { startLine: root.startLine } : {}),
      lineNumber: root.lineNumber,
      body,
      side: 'modified',
      replyToNoteId: root.id
    })
    setSaving(false)
    if (saved) {
      setDraft('')
      setComposing(false)
    }
  }

  return (
    <div className={replies.length > 0 ? 'orca-diff-comment-agent-replies' : undefined}>
      {replies.map((reply) => (
        <div key={reply.id} className="orca-diff-comment-agent-reply" data-agent-reply={reply.id}>
          <div className="orca-diff-comment-agent-reply-header">
            {reply.agentAuthor ? (
              <>
                <AgentNoteIcon name={reply.agentAuthor.name} />
                <span className="orca-diff-comment-agent-name">{reply.agentAuthor.name}</span>
              </>
            ) : (
              <>
                <User className="size-3.5 text-muted-foreground" aria-hidden />
                <span>{youLabel}</span>
                {reply.sentAt ? (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {translate('auto.components.diff.comments.NoteThread.sent', 'sent')}
                  </span>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="orca-diff-comment-pill-btn orca-diff-comment-pill-btn-danger ml-auto"
              title={deleteLabel}
              aria-label={deleteLabel}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onDelete(reply.id)
              }}
            >
              <Trash className="size-3" />
            </button>
          </div>
          <div className="orca-diff-comment-body">{reply.body}</div>
        </div>
      ))}
      {composing ? (
        <div className="orca-diff-comment-thread-composer">
          <ImeTextarea
            data-note-thread-reply=""
            autoFocus
            rows={2}
            value={draft}
            placeholder={translate(
              'auto.components.diff.comments.NoteThread.placeholder',
              'Ask a follow-up…'
            )}
            className="orca-diff-comment-popover-textarea"
            onChange={(event) => {
              setDraft(event.target.value)
              fitToContent(event.currentTarget)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void submit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setComposing(false)
              }
            }}
          />
          <button
            type="button"
            className="orca-diff-comment-pill-btn"
            aria-label={addLabel}
            title={addLabel}
            disabled={saving || !draft.trim()}
            onClick={() => void submit()}
          >
            <CornerDownLeft className="size-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="orca-diff-comment-thread-reply-btn"
          aria-label={replyLabel}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setComposing(true)
          }}
        >
          <MessageSquareReply className="size-3" />
          {replyLabel}
        </button>
      )}
    </div>
  )
}
