import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const ciTriageApi = {
  log: (entry) => ipcRenderer.invoke('ciTriage:log', entry)
} satisfies PreloadApi['ciTriage']
