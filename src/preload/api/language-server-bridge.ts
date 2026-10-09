import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const languageServerApi = {
  definition: (args) => ipcRenderer.invoke('languageServer:definition', args),
  hover: (args) => ipcRenderer.invoke('languageServer:hover', args),
  references: (args) => ipcRenderer.invoke('languageServer:references', args),
  stop: (args) => ipcRenderer.invoke('languageServer:stop', args)
} satisfies PreloadApi['languageServer']
