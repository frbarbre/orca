import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const pythonApi = {
  definition: (args) => ipcRenderer.invoke('python:definition', args)
} satisfies PreloadApi['python']
