import type { DiffComment } from '../../../../shared/diff-comment-types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'

type StatusByPaneKey = Readonly<Record<string, AgentStatusEntry | undefined>>

/** The thread's last message when it is a sent question still waiting on an agent. */
function openQuestion(thread: readonly DiffComment[]): (DiffComment & { sentAt: number }) | null {
  const last = thread.at(-1)
  return last && !last.agentAuthor && last.sentAt && !last.answeredAt
    ? (last as DiffComment & { sentAt: number })
    : null
}

/** Without a recorded pane, any agent in the workspace stands in for the one asked. */
function askedPanes(
  question: DiffComment,
  worktreeTabIds: readonly string[],
  statusByPaneKey: StatusByPaneKey
): AgentStatusEntry[] {
  const keys = question.sentToPaneKey
    ? [question.sentToPaneKey]
    : Object.keys(statusByPaneKey).filter((key) =>
        worktreeTabIds.some((tabId) => key.startsWith(`${tabId}:`))
      )
  return keys.flatMap((key) => {
    const entry = statusByPaneKey[key]
    return entry ? [entry] : []
  })
}

function firstDoneSince(entry: AgentStatusEntry, since: number): number | null {
  const done = [
    ...(entry.stateHistory ?? []),
    { state: entry.state, startedAt: entry.stateStartedAt }
  ].filter((state) => state.state === 'done' && state.startedAt >= since)
  return done.length > 0 ? Math.min(...done.map((state) => state.startedAt)) : null
}

/**
 * Fork: when the agent asked finished a turn after the question was sent, so the question counts
 * as answered even if that same tab has since gone on to other work; null while it has not.
 */
export function noteThreadAnsweredAt(
  thread: readonly DiffComment[],
  worktreeTabIds: readonly string[],
  statusByPaneKey: StatusByPaneKey
): number | null {
  const question = openQuestion(thread)
  if (!question) {
    return null
  }
  const answered = askedPanes(question, worktreeTabIds, statusByPaneKey)
    .map((entry) => firstDoneSince(entry, question.sentAt))
    .filter((at): at is number => at !== null)
  return answered.length > 0 ? Math.min(...answered) : null
}

/** Fork: who is working on an answer to a thread whose last message is a sent question, or null. */
export function noteThreadThinkingAgent(
  thread: readonly DiffComment[],
  worktreeTabIds: readonly string[],
  statusByPaneKey: StatusByPaneKey
): string | null {
  const question = openQuestion(thread)
  if (!question || noteThreadAnsweredAt(thread, worktreeTabIds, statusByPaneKey) !== null) {
    return null
  }
  const working = askedPanes(question, worktreeTabIds, statusByPaneKey).find(
    (entry) => entry.state === 'working'
  )
  return working ? formatAgentTypeLabel(working.agentType) : null
}
