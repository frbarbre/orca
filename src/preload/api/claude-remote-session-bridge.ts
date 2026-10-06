import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { ClaudeWebReplayedKey } from '../../shared/claude-remote-session'

export const claudeRemoteSessionApi = {
  resolveUrl: (args: { sessionId: string }) =>
    ipcRenderer.invoke('claudeRemoteSession:resolveUrl', args),
  attachGuest: (args: { webContentsId: number }) =>
    ipcRenderer.invoke('claudeRemoteSession:attachGuest', args),
  onReplayKey: (callback: (key: ClaudeWebReplayedKey) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, key: ClaudeWebReplayedKey): void =>
      callback(key)
    ipcRenderer.on('claudeRemoteSession:replayKey', listener)
    return () => {
      ipcRenderer.removeListener('claudeRemoteSession:replayKey', listener)
    }
  }
} satisfies PreloadApi['claudeRemoteSession']
