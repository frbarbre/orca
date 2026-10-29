import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const formatterApi = {
  format: (args) => ipcRenderer.invoke('formatter:format', args),
  stop: (args) => ipcRenderer.invoke('formatter:stop', args)
} satisfies PreloadApi['formatter']
