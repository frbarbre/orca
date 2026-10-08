import React, { useMemo } from 'react'
import { Bot } from 'lucide-react'
import { useAppStore } from '@/store'
import { useWorktreeAgentNotes } from '@/lib/agent-notes'
import { translate } from '@/i18n/i18n'

export function AgentNoteFileBadge({ filePath }: { filePath: string }): React.JSX.Element | null {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const notes = useWorktreeAgentNotes(worktreeId)
  const count = useMemo(
    () => notes.filter((note) => note.filePath === filePath).length,
    [notes, filePath]
  )
  if (count === 0) {
    return null
  }
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 text-[10px] text-ai-action-accent"
      title={translate(
        'auto.components.right.sidebar.AgentNoteFileBadge.title',
        '{{value0}} agent note{{value1}}',
        { value0: count, value1: count === 1 ? '' : 's' }
      )}
    >
      <Bot className="size-3" />
      <span className="tabular-nums">{count}</span>
    </span>
  )
}
