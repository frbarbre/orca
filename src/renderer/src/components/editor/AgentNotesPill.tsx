import React from 'react'
import { Bot } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { useFileAgentNotes } from '@/lib/agent-notes'
import { getDiffCommentLineLabel } from '@/lib/diff-comment-compat'
import { translate } from '@/i18n/i18n'

export function AgentNotesPill({
  worktreeId,
  filePath
}: {
  worktreeId: string
  filePath: string
}): React.JSX.Element | null {
  const notes = useFileAgentNotes(worktreeId, filePath)
  const setScrollToDiffCommentId = useAppStore((s) => s.setScrollToDiffCommentId)
  if (notes.length === 0) {
    return null
  }
  const label = translate('auto.components.editor.AgentNotesPill.label', 'Agent notes')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-ai-action-accent/40 bg-ai-action-accent/10 px-2 text-[11px] font-medium leading-none text-ai-action-accent hover:bg-ai-action-accent/20"
        >
          <Bot className="size-3" />
          {label}
          <span className="tabular-nums">{notes.length}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[360px]">
        <DropdownMenuLabel>
          {translate(
            'auto.components.editor.AgentNotesPill.heading',
            'Left by agents, not sent to them'
          )}
        </DropdownMenuLabel>
        {notes.map((note) => (
          <DropdownMenuItem key={note.id} onSelect={() => setScrollToDiffCommentId(note.id)}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Bot className="size-3 text-ai-action-accent" />
                {note.agentAuthor?.name} · {getDiffCommentLineLabel(note).toLowerCase()}
              </span>
              <span className="line-clamp-2 text-xs">{note.body}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
