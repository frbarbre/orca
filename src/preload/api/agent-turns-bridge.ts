import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const agentTurnsApi = {
  list: (args) => ipcRenderer.invoke('agentTurns:list', args),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, change: { worktreePath: string }) =>
      callback(change)
    ipcRenderer.on('agentTurns:changed', listener)
    return () => ipcRenderer.removeListener('agentTurns:changed', listener)
  }
} satisfies PreloadApi['agentTurns']
