import { describe, expect, it } from 'vitest'
import { shellEditorSpawnEnv } from './shell-editor-spawn'

const plainShell = {
  enabled: true,
  isWindows: false,
  connectionId: undefined,
  command: undefined,
  launchAgent: undefined,
  launchConfig: undefined,
  resumeProviderSession: undefined,
  env: { FOO: 'bar' }
}

describe('shellEditorSpawnEnv', () => {
  it('asks a fresh local shell for the editor', () => {
    expect(shellEditorSpawnEnv(plainShell)).toEqual({ FOO: 'bar', ORCA_SHELL_EDITOR: '1' })
    expect(shellEditorSpawnEnv({ ...plainShell, env: undefined })).toEqual({
      ORCA_SHELL_EDITOR: '1'
    })
  })

  it('keeps the editor for a shell started with a command, like a quick command', () => {
    expect(shellEditorSpawnEnv({ ...plainShell, command: 'mise run fu' })).toEqual({
      FOO: 'bar',
      ORCA_SHELL_EDITOR: '1'
    })
  })

  it('leaves every other spawn alone', () => {
    for (const other of [
      { enabled: false },
      { isWindows: true },
      { connectionId: 'ssh-1' },
      { command: 'claude' },
      { command: 'codex --yolo' },
      { launchAgent: 'codex' },
      { launchConfig: {} },
      { resumeProviderSession: { provider: 'claude' } }
    ]) {
      expect(shellEditorSpawnEnv({ ...plainShell, ...other })).toEqual({ FOO: 'bar' })
    }
  })
})
