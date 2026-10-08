import React, { useState } from 'react'
import { Bot, ChevronDown, Trash2 } from 'lucide-react'
import { removeAgentNote, useWorktreeAgentNotes } from '@/lib/agent-notes'
import { useAppStore } from '@/store'
import { selectWorktreeDiffComments } from '@/store/worktree-diff-comments-selector'
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
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment)
  const [expanded, setExpanded] = useState(false)
  if (notes.length === 0) {
    return null
  }
  const clearLabel = translate(
    'auto.components.right.sidebar.AgentNotesShelf.clearAll',
    'Clear all agent notes'
  )
  return (
    <div className="border-b border-border" data-testid="agent-notes-shelf">
      <div className="flex items-center justify-between gap-1 pr-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 pl-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => {
            // Why whole threads: a note an agent answered, and follow-ups to an agent, have done
            // their job once the answers go; leaving them would strand one half of a conversation.
            const threadRootIds = new Set<string>()
            for (const note of notes) {
              void removeAgentNote(worktreeId, note.id)
              threadRootIds.add(note.replyToNoteId ?? note.id)
            }
            const userNotes = selectWorktreeDiffComments(useAppStore.getState(), worktreeId) ?? []
            for (const note of userNotes) {
              if (
                threadRootIds.has(note.id) ||
                (note.replyToNoteId !== undefined && threadRootIds.has(note.replyToNoteId))
              ) {
                void deleteDiffComment(worktreeId, note.id)
              }
            }
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {expanded && (
        <div
          data-testid="agent-notes-shelf-list"
          className="max-h-64 overflow-y-auto scrollbar-sleek"
        >
          <DiffCommentsInlineList
            comments={[...notes]}
            stacked
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
        </div>
      )}
    </div>
  )
}
