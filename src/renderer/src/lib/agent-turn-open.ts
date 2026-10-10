import type { AgentTurn } from '../../../shared/agent-turns'
import type {
  GitBranchChangeEntry,
  GitCommitCompareResult,
  GitCommitCompareSummary
} from '../../../shared/git-diff-compare-types'

export type AgentTurnOpenDeps = {
  listTurns: (args: { worktreePath: string }) => Promise<AgentTurn[]>
  commitCompare: (args: {
    worktreePath: string
    commitId: string
  }) => Promise<GitCommitCompareResult>
  openCommitAllDiffs: (
    worktreeId: string,
    worktreePath: string,
    compare: GitCommitCompareSummary,
    entries: GitBranchChangeEntry[],
    subject?: string,
    message?: string
  ) => void
}

export function agentTurnTitle(turn: AgentTurn): string {
  return turn.prompt.trim().split('\n')[0]?.trim() || 'Agent turn'
}

// Why a commit diff: a turn's end snapshot has its start snapshot as parent, so the commit view
// shows exactly what the turn changed.
export async function openAgentTurn(
  worktreeId: string,
  worktreePath: string,
  turn: AgentTurn,
  deps: Pick<AgentTurnOpenDeps, 'commitCompare' | 'openCommitAllDiffs'>
): Promise<void> {
  const result = await deps.commitCompare({ worktreePath, commitId: turn.oid })
  if (result.summary.status !== 'ready') {
    throw new Error(result.summary.errorMessage ?? 'The turn could not be loaded.')
  }
  deps.openCommitAllDiffs(
    worktreeId,
    worktreePath,
    result.summary,
    result.entries,
    agentTurnTitle(turn),
    turn.prompt
  )
}

export async function openLatestAgentTurn(
  worktreeId: string,
  worktreePath: string,
  deps: AgentTurnOpenDeps
): Promise<boolean> {
  const [latest] = await deps.listTurns({ worktreePath })
  if (!latest) {
    return false
  }
  await openAgentTurn(worktreeId, worktreePath, latest, deps)
  return true
}
