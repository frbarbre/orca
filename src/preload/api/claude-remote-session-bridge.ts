import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const claudeRemoteSessionApi = {
  resolveUrl: (args: { sessionId: string }) =>
    ipcRenderer.invoke('claudeRemoteSession:resolveUrl', args),
  attachGuest: (args: { webContentsId: number }) =>
    ipcRenderer.invoke('claudeRemoteSession:attachGuest', args)
} satisfies PreloadApi['claudeRemoteSession']
