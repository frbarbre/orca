import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import { MATERIAL_ICON_CONFIG_FILE_NAME } from '../../shared/material-icon-config'
import { createMaterialIconConfigFile } from '../material-icons/material-icon-config-file'

const CHANGE_DEBOUNCE_MS = 150

// Fork: the Material Icon Theme settings file, ~/.orca/material-icon-theme.json, watched so a save
// applies at once.
export function registerMaterialIconHandlers(): void {
  const path = join(homedir(), '.orca', MATERIAL_ICON_CONFIG_FILE_NAME)
  const file = createMaterialIconConfigFile({
    path,
    exists: existsSync,
    read: (target) => readFileSync(target, 'utf8'),
    write: (target, text) => {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, text, 'utf8')
    }
  })

  ipcMain.handle('materialIcons:read', () => file.read())
  ipcMain.handle('materialIcons:ensure', () => {
    file.ensure()
    return file.read()
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const broadcast = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const snapshot = file.read()
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('materialIcons:changed', snapshot)
      }
    }, CHANGE_DEBOUNCE_MS)
  }
  try {
    mkdirSync(dirname(path), { recursive: true })
    // Why the folder: editors save by replacing the file, which a watch on the file itself loses.
    watch(dirname(path), (_event, changed) => {
      if (!changed || changed.toString() === basename(path)) {
        broadcast()
      }
    }).unref()
  } catch {
    // Watching is a convenience; the settings still load on start and on Reload.
  }
}
