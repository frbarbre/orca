import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const pythonApi = {
  definition: (args) => ipcRenderer.invoke('python:definition', args),
  hover: (args) => ipcRenderer.invoke('python:hover', args)
} satisfies PreloadApi['python']
