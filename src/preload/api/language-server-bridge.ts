import { ipcRenderer } from 'electron'
import type { EditorDiagnosticsEvent } from '../../shared/editor-diagnostics'
import type { PreloadApi } from '../api-types'

export const languageServerApi = {
  definition: (args) => ipcRenderer.invoke('languageServer:definition', args),
  hover: (args) => ipcRenderer.invoke('languageServer:hover', args),
  references: (args) => ipcRenderer.invoke('languageServer:references', args),
  completion: (args) => ipcRenderer.invoke('languageServer:completion', args),
  stop: (args) => ipcRenderer.invoke('languageServer:stop', args),
  sync: (args) => ipcRenderer.invoke('languageServer:sync', args),
  closeDocument: (args) => ipcRenderer.invoke('languageServer:close', args),
  onDiagnostics: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, event: EditorDiagnosticsEvent) =>
      callback(event)
    ipcRenderer.on('languageServer:diagnostics', listener)
    return () => ipcRenderer.removeListener('languageServer:diagnostics', listener)
  }
} satisfies PreloadApi['languageServer']
