import React, { useState } from 'react'
import { Bot, ChevronDown } from 'lucide-react'
import { removeAgentNote, useWorktreeAgentNotes } from '@/lib/agent-notes'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { DiffComment } from '../../../../../../shared/diff-comment-types'
import { DiffCommentsInlineList } from './diff-comments-list'

export function AgentNotesShelf({
  worktreeId,
  onOpenNote
}: {
  worktreeId: string
  onOpenNote: (note: DiffComment) => void
}): React.JSX.Element | null {
  const notes = useWorktreeAgentNotes(worktreeId)
  const [expanded, setExpanded] = useState(true)
  if (notes.length === 0) {
    return null
  }
  return (
    <div className="border-b border-border" data-testid="agent-notes-shelf">
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1.5 pl-3 pr-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={cn('size-3 shrink-0 transition-transform', !expanded && '-rotate-90')}
        />
        <Bot className="size-3.5 shrink-0 text-ai-action-accent" />
        <span>
          {translate('auto.components.right.sidebar.AgentNotesShelf.title', 'Agent notes')}
        </span>
        <span className="text-[11px] leading-none text-muted-foreground tabular-nums">
          {notes.length}
        </span>
      </button>
      {expanded && (
        <DiffCommentsInlineList
          comments={[...notes]}
          onDelete={(id) => void removeAgentNote(worktreeId, id)}
          onOpen={onOpenNote}
          onClearFile={(filePath) => {
            for (const note of notes) {
              if (note.filePath === filePath) {
                void removeAgentNote(worktreeId, note.id)
              }
            }
          }}
        />
      )}
    </div>
  )
}
