import React from 'react'
import { Bot, Trash } from 'lucide-react'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { translate } from '@/i18n/i18n'

export function AgentNoteRepliesList({
  replies,
  onDelete
}: {
  replies: readonly DiffComment[]
  onDelete: (replyId: string) => void
}): React.JSX.Element {
  const deleteLabel = translate(
    'auto.components.diff.comments.AgentNoteReplies.delete',
    'Delete reply'
  )
  return (
    <div className="orca-diff-comment-agent-replies">
      {replies.map((reply) => (
        <div key={reply.id} className="orca-diff-comment-agent-reply" data-agent-reply={reply.id}>
          <div className="orca-diff-comment-agent-reply-header">
            <Bot className="orca-diff-comment-agent-icon size-3.5" aria-hidden />
            <span className="orca-diff-comment-agent-name">{reply.agentAuthor?.name}</span>
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
    </div>
  )
}
