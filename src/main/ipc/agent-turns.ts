import { ipcMain } from 'electron'
import { listAgentTurns } from '../agent-turns/agent-turn-snapshots'

export function registerAgentTurnHandlers(): void {
  ipcMain.handle('agentTurns:list', (_event, args: { worktreePath: string }) =>
    listAgentTurns(args.worktreePath).catch(() => [])
  )
}
