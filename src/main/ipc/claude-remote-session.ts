import { BrowserWindow, clipboard, ipcMain, Menu, shell, webContents } from 'electron'
import type { KeybindingOverrides } from '../../shared/keybindings'
import type { ClaudeRemoteSessionUrlResult } from '../../shared/claude-remote-session'
import { resolveClaudeRemoteSessionUrl } from '../claude/claude-remote-session-url'
import { installClaudeWebGuestShortcuts } from '../claude/claude-web-guest-shortcuts'
import { installClaudeWebContextMenu } from '../claude/claude-web-context-menu'
import { installClaudeWebExternalLinks } from '../claude/claude-web-external-links'
import { sendResolvedWindowShortcutAction } from '../window/main-window-shortcut-actions'

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
      const host = event.sender
      installClaudeWebContextMenu(guest, {
        showMenu: (items, separatorBefore) =>
          Menu.buildFromTemplate(
            items.flatMap((item, index) => [
              ...(index === separatorBefore ? [{ type: 'separator' as const }] : []),
              { label: item.label, enabled: item.enabled, click: item.click }
            ])
          ).popup(),
        openExternal: (url) => void shell.openExternal(url),
        writeClipboard: (text) => clipboard.writeText(text)
      })
      installClaudeWebExternalLinks(guest)
      installClaudeWebGuestShortcuts(
        guest,
        getKeybindings,
        (key) => {
          if (!host.isDestroyed()) {
            host.send('claudeRemoteSession:replayKey', key)
          }
        },
        (action) => {
          const window = host.isDestroyed() ? null : BrowserWindow.fromWebContents(host)
          if (window) {
            sendResolvedWindowShortcutAction(window, action)
          }
        }
      )
    }
  )
}
