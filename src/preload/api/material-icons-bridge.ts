import { ipcRenderer } from 'electron'
import type { MaterialIconConfigSnapshot } from '../../shared/material-icon-config'
import type { PreloadApi } from '../api-types'

export const materialIconsApi = {
  read: () => ipcRenderer.invoke('materialIcons:read'),
  ensure: () => ipcRenderer.invoke('materialIcons:ensure'),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: MaterialIconConfigSnapshot) =>
      callback(snapshot)
    ipcRenderer.on('materialIcons:changed', listener)
    return () => ipcRenderer.removeListener('materialIcons:changed', listener)
  }
} satisfies PreloadApi['materialIcons']
