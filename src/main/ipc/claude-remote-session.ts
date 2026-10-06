import { ipcMain, webContents } from 'electron'
import type { KeybindingOverrides } from '../../shared/keybindings'
import type { ClaudeRemoteSessionUrlResult } from '../../shared/claude-remote-session'
import { resolveClaudeRemoteSessionUrl } from '../claude/claude-remote-session-url'
import { installClaudeWebGuestShortcuts } from '../claude/claude-web-guest-shortcuts'

export function registerClaudeRemoteSessionHandlers(
  getKeybindings: () => KeybindingOverrides | undefined
): void {
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

  ipcMain.handle(
    'claudeRemoteSession:attachGuest',
    (event, args: { webContentsId?: unknown }): void => {
      const id = args?.webContentsId
      const guest = typeof id === 'number' ? webContents.fromId(id) : undefined
      // Why: only a webview the calling window hosts may be given shortcuts, never another guest.
      if (!guest || guest.getType() !== 'webview' || guest.hostWebContents !== event.sender) {
        return
      }
      installClaudeWebGuestShortcuts(guest, getKeybindings)
    }
  )
}
