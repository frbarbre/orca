import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { getUserKeybindingsPath } from '../keybindings/keybinding-file'
import { customEditorThemeDirectory } from '../editor-theme/custom-editor-theme'
import { EDITOR_THEME_FILE_NAMES, type SettingsTransferFiles } from '../../shared/settings-transfer'

const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export type SettingsTransferSaveResult = { ok: true; path: string } | { ok: false; error?: string }
export type SettingsTransferOpenResult = { ok: true; text: string } | { ok: false; error?: string }

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export async function readSettingsTransferFiles(home = homedir()): Promise<SettingsTransferFiles> {
  const editorThemes: SettingsTransferFiles['editorThemes'] = {}
  for (const name of EDITOR_THEME_FILE_NAMES) {
    const theme = await readOptional(join(customEditorThemeDirectory(), name))
    if (theme !== null && isJson(theme)) {
      editorThemes[name] = theme
    }
  }
  const keybindings = await readOptional(getUserKeybindingsPath(home))
  return {
    keybindings: keybindings !== null && isJson(keybindings) ? keybindings : null,
    editorThemes
  }
}

// Why JSON-checked before writing: a broken keybindings file or theme would fail to load on the
// next start, and the import must not leave Orca worse than it found it.
export async function writeSettingsTransferFiles(
  files: SettingsTransferFiles,
  home = homedir()
): Promise<void> {
  if (files.keybindings !== null && isJson(files.keybindings)) {
    const path = getUserKeybindingsPath(home)
    await mkdir(join(home, '.orca'), { recursive: true })
    await writeFile(path, files.keybindings, 'utf8')
  }
  const themeDir = customEditorThemeDirectory()
  for (const name of EDITOR_THEME_FILE_NAMES) {
    const theme = files.editorThemes[name]
    if (typeof theme === 'string' && isJson(theme)) {
      await mkdir(themeDir, { recursive: true })
      await writeFile(join(themeDir, name), theme, 'utf8')
    }
  }
}

export function registerSettingsTransferHandlers(): void {
  ipcMain.handle('settings-transfer:read-files', () => readSettingsTransferFiles())

  ipcMain.handle('settings-transfer:write-files', (_event, files: SettingsTransferFiles) =>
    writeSettingsTransferFiles(files)
  )

  ipcMain.handle(
    'settings-transfer:save',
    async (event, text: string): Promise<SettingsTransferSaveResult> => {
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const options = {
        title: 'Export Orca settings',
        defaultPath: join(homedir(), 'Downloads', 'orca-settings.json'),
        filters: [{ name: 'Orca settings', extensions: ['json'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) {
        return { ok: false }
      }
      try {
        await writeFile(result.filePath, text, 'utf8')
        return { ok: true, path: result.filePath }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('settings-transfer:open', async (event): Promise<SettingsTransferOpenResult> => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: 'Import Orca settings',
      properties: ['openFile' as const],
      filters: [{ name: 'Orca settings', extensions: ['json'] }]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    const path = result.filePaths[0]
    if (result.canceled || !path) {
      return { ok: false }
    }
    try {
      const text = await readFile(path, 'utf8')
      if (Buffer.byteLength(text) > MAX_IMPORT_BYTES) {
        return { ok: false, error: 'The file is too large to be an Orca settings export.' }
      }
      return { ok: true, text }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
