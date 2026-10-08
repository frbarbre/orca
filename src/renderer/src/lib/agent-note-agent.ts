import type { TuiAgent } from '../../../shared/tui-agent'
import { getAgentCatalog } from '@/lib/agent-catalog'

// Fork: an agent signs its note with a free-text name (`--agent "Claude Code"`); this finds the
// catalog agent behind it so the note can show that agent's icon.
export function agentFromNoteAuthor(name: string): TuiAgent | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted) {
    return null
  }
  let best: { id: TuiAgent; length: number } | null = null
  for (const entry of getAgentCatalog()) {
    const label = entry.label.toLowerCase()
    if (entry.id === wanted || label === wanted) {
      return entry.id
    }
    if (wanted.startsWith(`${label} `) && label.length > (best?.length ?? 0)) {
      best = { id: entry.id, length: label.length }
    }
  }
  return best?.id ?? null
}
