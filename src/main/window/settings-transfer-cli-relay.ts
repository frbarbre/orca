import { randomUUID } from 'node:crypto'

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type {
  SettingsTransferCliAction,
  SettingsTransferCliReply,
  SettingsTransferCliResult
} from '../../shared/settings-transfer-cli'
import { setSettingsTransferRequester } from '../host/settings-transfer-cli-port'

const SETTINGS_TRANSFER_CLI_TIMEOUT_MS = 30_000

let settingsWindow: BrowserWindow | null = null

export function trackSettingsTransferWindow(window: BrowserWindow): void {
  settingsWindow = window
  setSettingsTransferRequester((action) => requestSettingsTransferFromWindow(action, window))
  window.on('closed', () => {
    if (settingsWindow === window) {
      settingsWindow = null
      setSettingsTransferRequester(null)
    }
  })
}

/** Runs an export or import in the window, through the same code as the Settings screen. */
export function requestSettingsTransferFromWindow(
  action: SettingsTransferCliAction,
  window: BrowserWindow
): Promise<SettingsTransferCliResult> {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return Promise.reject(new Error('Orca has no open window to export or import settings in.'))
  }
  const webContents = window.webContents
  const requestId = randomUUID()
  return new Promise<SettingsTransferCliResult>((resolve, reject) => {
    const finish = (error: Error | null, result?: SettingsTransferCliResult): void => {
      clearTimeout(timeout)
      ipcMain.removeListener('settingsTransfer:cliReply', onReply)
      if (error) {
        reject(error)
      } else if (result) {
        resolve(result)
      }
    }
    const timeout = setTimeout(
      () => finish(new Error('settings_transfer_timeout')),
      SETTINGS_TRANSFER_CLI_TIMEOUT_MS
    )
    const onReply = (event: Electron.IpcMainEvent, reply: SettingsTransferCliReply): void => {
      if (event.sender !== webContents || reply.requestId !== requestId) {
        return
      }
      if ('error' in reply) {
        finish(new Error(reply.error))
      } else if ('text' in reply) {
        finish(null, { text: reply.text })
      } else {
        finish(null, { summary: reply.summary })
      }
    }
    ipcMain.on('settingsTransfer:cliReply', onReply)
    webContents.send('settingsTransfer:cliRequest', { ...action, requestId })
  })
}
