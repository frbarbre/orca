export type AgentTurnObservation = {
  paneKey: string
  worktreePath: string
  agent: string
  state: string
  turnStartedAt?: number
  prompt?: string
}

export type AgentTurnAction =
  | { kind: 'start'; paneKey: string; worktreePath: string }
  | {
      kind: 'end'
      paneKey: string
      worktreePath: string
      prompt: string
      agent: string
      startedAt: number
    }

type OpenTurn = { worktreePath: string; prompt: string; agent: string; startedAt: number }

export function createAgentTurnTracker(): {
  observe: (event: AgentTurnObservation) => AgentTurnAction[]
} {
  const open = new Map<string, OpenTurn>()

  const close = (paneKey: string): AgentTurnAction[] => {
    const turn = open.get(paneKey)
    if (!turn) {
      return []
    }
    open.delete(paneKey)
    return [{ kind: 'end', paneKey, ...turn }]
  }

  return {
    observe: (event) => {
      if (event.state === 'done') {
        return close(event.paneKey)
      }
      if (event.state !== 'working' || event.turnStartedAt === undefined) {
        return []
      }
      const current = open.get(event.paneKey)
      if (current?.startedAt === event.turnStartedAt) {
        if (!current.prompt && event.prompt) {
          current.prompt = event.prompt
        }
        return []
      }
      const actions = close(event.paneKey)
      open.set(event.paneKey, {
        worktreePath: event.worktreePath,
        prompt: event.prompt ?? '',
        agent: event.agent,
        startedAt: event.turnStartedAt
      })
      return [
        ...actions,
        { kind: 'start', paneKey: event.paneKey, worktreePath: event.worktreePath }
      ]
    }
  }
}
