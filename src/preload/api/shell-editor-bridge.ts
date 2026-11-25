import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const shellEditorApi = {
  readHistory: (args: { path: string }) => ipcRenderer.invoke('shellEditor:readHistory', args),
  gitDiffStat: (args: { cwd: string }) => ipcRenderer.invoke('shellEditor:gitDiffStat', args)
} satisfies PreloadApi['shellEditor']
