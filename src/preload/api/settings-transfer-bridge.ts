import { ipcRenderer } from 'electron'
import type { SettingsTransferFiles } from '../../shared/settings-transfer'
import type {
  SettingsTransferCliReply,
  SettingsTransferCliRequest
} from '../../shared/settings-transfer-cli'

export type SettingsTransferApi = {
  readFiles: () => Promise<SettingsTransferFiles>
  writeFiles: (files: SettingsTransferFiles) => Promise<void>
  save: (text: string) => Promise<{ ok: true; path: string } | { ok: false; error?: string }>
  open: () => Promise<{ ok: true; text: string } | { ok: false; error?: string }>
  onCliRequest: (callback: (request: SettingsTransferCliRequest) => void) => () => void
  replyCliRequest: (reply: SettingsTransferCliReply) => void
}

export const settingsTransferApi: SettingsTransferApi = {
  readFiles: () => ipcRenderer.invoke('settings-transfer:read-files'),
  writeFiles: (files) => ipcRenderer.invoke('settings-transfer:write-files', files),
  save: (text) => ipcRenderer.invoke('settings-transfer:save', text),
  open: () => ipcRenderer.invoke('settings-transfer:open'),
  onCliRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, request: SettingsTransferCliRequest) =>
      callback(request)
    ipcRenderer.on('settingsTransfer:cliRequest', listener)
    return () => ipcRenderer.removeListener('settingsTransfer:cliRequest', listener)
  },
  replyCliRequest: (reply) => ipcRenderer.send('settingsTransfer:cliReply', reply)
}
