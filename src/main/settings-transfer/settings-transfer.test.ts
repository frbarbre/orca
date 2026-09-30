import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const home = mkdtempSync(join(tmpdir(), 'orca-settings-transfer-'))
const themeDir = join(home, '.orca', 'themes')

vi.mock('electron', () => ({ BrowserWindow: {}, dialog: {}, ipcMain: { handle: vi.fn() } }))
vi.mock('../editor-theme/custom-editor-theme', () => ({
  customEditorThemeDirectory: () => themeDir
}))

import { readSettingsTransferFiles, writeSettingsTransferFiles } from './settings-transfer'

describe('settings transfer files', () => {
  beforeEach(() => rmSync(join(home, '.orca'), { recursive: true, force: true }))
  afterEach(() => rmSync(join(home, '.orca'), { recursive: true, force: true }))

  it('reads keybindings and editor themes, skipping files that are not JSON', async () => {
    mkdirSync(themeDir, { recursive: true })
    writeFileSync(join(home, '.orca', 'keybindings.json'), '{"tab.rename":[]}')
    writeFileSync(join(themeDir, 'editor-dark.json'), '{"base":"vs-dark"}')
    writeFileSync(join(themeDir, 'editor-light.json'), 'not json')

    expect(await readSettingsTransferFiles(home)).toEqual({
      keybindings: '{"tab.rename":[]}',
      editorThemes: { 'editor-dark.json': '{"base":"vs-dark"}' }
    })
  })

  it('writes valid files into place and refuses broken ones', async () => {
    await writeSettingsTransferFiles(
      { keybindings: '{"tab.rename":[]}', editorThemes: { 'editor-dark.json': 'broken' } },
      home
    )

    expect(readFileSync(join(home, '.orca', 'keybindings.json'), 'utf8')).toBe('{"tab.rename":[]}')
    expect(existsSync(join(themeDir, 'editor-dark.json'))).toBe(false)
  })

  it('leaves the keybindings file alone when the export had none', async () => {
    mkdirSync(join(home, '.orca'), { recursive: true })
    writeFileSync(join(home, '.orca', 'keybindings.json'), '{"mine":[]}')

    await writeSettingsTransferFiles({ keybindings: null, editorThemes: {} }, home)

    expect(readFileSync(join(home, '.orca', 'keybindings.json'), 'utf8')).toBe('{"mine":[]}')
  })
})
