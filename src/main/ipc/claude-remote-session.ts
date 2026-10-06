import { ipcMain } from 'electron'
import type { ClaudeRemoteSessionUrlResult } from '../../shared/claude-remote-session'
import { resolveClaudeRemoteSessionUrl } from '../claude/claude-remote-session-url'

export function registerClaudeRemoteSessionHandlers(): void {
  ipcMain.handle(
    'claudeRemoteSession:resolveUrl',
    async (_event, args: { sessionId?: unknown }): Promise<ClaudeRemoteSessionUrlResult> => {
      const sessionId = args?.sessionId
      if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 200) {
        return { status: 'session-not-found' }
      }
      return resolveClaudeRemoteSessionUrl(sessionId)
    }
  )
}
