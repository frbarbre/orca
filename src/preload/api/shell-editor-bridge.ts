import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const shellEditorApi = {
  readHistory: (args: { path: string }) => ipcRenderer.invoke('shellEditor:readHistory', args),
  gitDiffStat: (args: { cwd: string }) => ipcRenderer.invoke('shellEditor:gitDiffStat', args),
  complete: (args: { cwd: string; line: string }) =>
    ipcRenderer.invoke('shellEditor:complete', args),
  warmCompletion: () => ipcRenderer.invoke('shellEditor:warmCompletion')
} satisfies PreloadApi['shellEditor']
