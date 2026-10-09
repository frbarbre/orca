import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const gitBlameApi = {
  line: (args) => ipcRenderer.invoke('gitBlame:line', args),
  links: (args) => ipcRenderer.invoke('gitBlame:links', args)
} satisfies PreloadApi['gitBlame']
