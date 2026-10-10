import { timeAgo } from '@/lib/git-blame-text'
import type { AgentTurn } from '../../../../../../shared/agent-turns'

export function agentTurnTitle(turn: AgentTurn): string {
  return turn.prompt.trim().split('\n')[0]?.trim() || 'Agent turn'
}

export function agentTurnDetail(turn: AgentTurn, now: number): string {
  const files = `${turn.files} ${turn.files === 1 ? 'file' : 'files'}`
  return `${turn.agent} · ${timeAgo(turn.completedAt / 1000, now)} · ${files} +${turn.insertions} −${turn.deletions}`
}
