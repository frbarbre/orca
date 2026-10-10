import { BrowserWindow } from 'electron'
import type { Repo } from '../../shared/repo-types'
import { isFolderRepo } from '../../shared/repo-kind'
import { getRepoIdFromWorktreeId, splitWorktreeIdForFilesystem } from '../../shared/worktree/id'
import { recordAgentTurn, snapshotWorktree } from './agent-turn-snapshots'
import { createAgentTurnTracker } from './agent-turn-tracker'

export type AgentTurnHookEvent = {
  paneKey: string
  tabId: string | undefined
  worktreeId: string | undefined
  payload: { state: string; prompt?: string; agentType?: string }
  turnStartedAt?: number
}

export type AgentTurnRecorderDeps = {
  getRepo: (repoId: string) => Repo | undefined
  resolveWorktreeIdForTab: (tabId: string) => string | undefined
}

const tracker = createAgentTurnTracker()
const startSnapshots = new Map<string, Promise<string | null>>()
const worktreeQueues = new Map<string, Promise<unknown>>()

function inWorktreeQueue<T>(worktreePath: string, task: () => Promise<T>): Promise<T> {
  const next = (worktreeQueues.get(worktreePath) ?? Promise.resolve()).then(task, task)
  worktreeQueues.set(
    worktreePath,
    next.catch(() => undefined)
  )
  return next
}

// Why local git repos only: snapshots run git in the worktree on this machine; SSH and folder
// workspaces have no local repo to write the refs into.
function localWorktreePath(
  event: AgentTurnHookEvent,
  deps: AgentTurnRecorderDeps
): string | undefined {
  const worktreeId =
    (event.tabId ? deps.resolveWorktreeIdForTab(event.tabId) : undefined) ?? event.worktreeId
  if (!worktreeId) {
    return undefined
  }
  const repo = deps.getRepo(getRepoIdFromWorktreeId(worktreeId))
  if (!repo || isFolderRepo(repo) || repo.connectionId) {
    return undefined
  }
  return splitWorktreeIdForFilesystem(worktreeId)?.worktreePath
}

// Fork: snapshot the worktree when an agent turn starts and ends, so each turn's diff can be shown.
export function observeAgentTurn(event: AgentTurnHookEvent, deps: AgentTurnRecorderDeps): void {
  const worktreePath = localWorktreePath(event, deps)
  if (!worktreePath) {
    return
  }
  const actions = tracker.observe({
    paneKey: event.paneKey,
    worktreePath,
    agent: event.payload.agentType ?? 'agent',
    state: event.payload.state,
    turnStartedAt: event.turnStartedAt,
    prompt: event.payload.prompt
  })
  for (const action of actions) {
    if (action.kind === 'start') {
      startSnapshots.set(
        action.paneKey,
        inWorktreeQueue(action.worktreePath, () => snapshotWorktree(action.worktreePath)).catch(
          () => null
        )
      )
      continue
    }
    const start = startSnapshots.get(action.paneKey)
    startSnapshots.delete(action.paneKey)
    void start?.then(async (startOid) => {
      if (!startOid) {
        return
      }
      const turn = await inWorktreeQueue(action.worktreePath, () =>
        recordAgentTurn({
          worktreePath: action.worktreePath,
          startOid,
          prompt: action.prompt,
          agent: action.agent,
          paneKey: action.paneKey,
          startedAt: action.startedAt,
          completedAt: Date.now()
        })
      ).catch(() => null)
      if (turn) {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('agentTurns:changed', { worktreePath: action.worktreePath })
        }
      }
    })
  }
}
