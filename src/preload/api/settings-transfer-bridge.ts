import { ipcRenderer } from 'electron'
import type { SettingsTransferFiles } from '../../shared/settings-transfer'

export type SettingsTransferApi = {
  readFiles: () => Promise<SettingsTransferFiles>
  writeFiles: (files: SettingsTransferFiles) => Promise<void>
  save: (text: string) => Promise<{ ok: true; path: string } | { ok: false; error?: string }>
  open: () => Promise<{ ok: true; text: string } | { ok: false; error?: string }>
}

export const settingsTransferApi: SettingsTransferApi = {
  readFiles: () => ipcRenderer.invoke('settings-transfer:read-files'),
  writeFiles: (files) => ipcRenderer.invoke('settings-transfer:write-files', files),
  save: (text) => ipcRenderer.invoke('settings-transfer:save', text),
  open: () => ipcRenderer.invoke('settings-transfer:open')
}
