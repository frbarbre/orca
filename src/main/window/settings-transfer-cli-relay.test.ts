import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcEmitter = new EventEmitter()
vi.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: (...args: unknown[]) => void) =>
      ipcEmitter.on(channel, listener),
    removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
      ipcEmitter.removeListener(channel, listener)
  }
}))

import {
  requestSettingsTransferFromWindow,
  trackSettingsTransferWindow
} from './settings-transfer-cli-relay'

function createWindow() {
  const webContents = { isDestroyed: () => false, send: vi.fn() }
  const window = Object.assign(new EventEmitter(), { isDestroyed: () => false, webContents })
  return { window, webContents }
}

function sentRequest(webContents: { send: ReturnType<typeof vi.fn> }) {
  return webContents.send.mock.calls[0]?.[1] as { requestId: string; kind: string }
}

describe('settings transfer CLI relay', () => {
  beforeEach(() => ipcEmitter.removeAllListeners())

  it("resolves with the tracked window's reply to its own request", async () => {
    const { window, webContents } = createWindow()
    trackSettingsTransferWindow(window as never)
    const pending = requestSettingsTransferFromWindow({ kind: 'export' })
    const request = sentRequest(webContents)

    expect(webContents.send).toHaveBeenCalledWith('settingsTransfer:cliRequest', request)
    ipcEmitter.emit(
      'settingsTransfer:cliReply',
      { sender: {} },
      { requestId: request.requestId, text: 'x' }
    )
    ipcEmitter.emit(
      'settingsTransfer:cliReply',
      { sender: webContents },
      { requestId: request.requestId, text: '{}' }
    )

    await expect(pending).resolves.toEqual({ text: '{}' })
  })

  it("rejects with the window's error", async () => {
    const { window, webContents } = createWindow()
    const pending = requestSettingsTransferFromWindow(
      { kind: 'import', text: 'nope' },
      window as never
    )
    ipcEmitter.emit(
      'settingsTransfer:cliReply',
      { sender: webContents },
      { requestId: sentRequest(webContents).requestId, error: 'The file is not valid JSON.' }
    )

    await expect(pending).rejects.toThrow('The file is not valid JSON.')
  })

  it('refuses when Orca has no window', async () => {
    const { window } = createWindow()
    trackSettingsTransferWindow(window as never)
    window.emit('closed')

    await expect(requestSettingsTransferFromWindow({ kind: 'export' })).rejects.toThrow(
      'Orca has no open window'
    )
  })
})
