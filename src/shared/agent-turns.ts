export type AgentTurn = {
  ref: string
  oid: string
  parentOid: string
  prompt: string
  agent: string
  paneKey: string
  startedAt: number
  completedAt: number
  files: number
  insertions: number
  deletions: number
}

export const AGENT_TURN_REF_PREFIX = 'refs/worktree/orca-turns/'
export const AGENT_TURNS_KEPT = 50
