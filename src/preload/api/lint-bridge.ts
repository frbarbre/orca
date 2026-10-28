import { ipcRenderer } from 'electron'
import type { LintDiagnosticsEvent } from '../../shared/linter'
import type { PreloadApi } from '../api-types'

export const lintApi = {
  sync: (args) => ipcRenderer.invoke('lint:sync', args),
  close: (args) => ipcRenderer.invoke('lint:close', args),
  stop: (args) => ipcRenderer.invoke('lint:stop', args),
  onDiagnostics: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, event: LintDiagnosticsEvent) =>
      callback(event)
    ipcRenderer.on('lint:diagnostics', listener)
    return () => ipcRenderer.removeListener('lint:diagnostics', listener)
  }
} satisfies PreloadApi['lint']
