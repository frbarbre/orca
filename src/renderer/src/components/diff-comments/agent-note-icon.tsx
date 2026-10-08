import React from 'react'
import { Bot } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentFromNoteAuthor } from '@/lib/agent-note-agent'

// Fork: the agent's own icon (Claude, Codex, …) on its notes; a bot when the name is unknown.
export function AgentNoteIcon({ name, size = 14 }: { name: string; size?: number }) {
  const agent = agentFromNoteAuthor(name)
  return (
    <span
      className="inline-flex shrink-0 items-center"
      data-agent-note-icon={agent ?? 'unknown'}
      aria-hidden
    >
      {agent ? <AgentIcon agent={agent} size={size} /> : <Bot size={size} />}
    </span>
  )
}
