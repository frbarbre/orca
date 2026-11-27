import { describe, expect, it, vi } from 'vitest'
import { OrcaRuntimeService, getDefaultWorkspaceSession } from '../../orca-runtime-test-mocks.spec'
import '../../orca-runtime-test-lifecycle.spec'
import {
  TEST_WORKTREE_ID,
  makeRuntimeStoreWithWorkspaceSession
} from '../../orca-runtime-test-fixtures.spec'
import { committingSpawn } from '../../bind-first-pane.test-fixture'
import type { TerminalCreateOptions } from '../../runtime-terminal-contracts'

async function spawnedEnv(
  terminalShellEditor: boolean,
  opts: TerminalCreateOptions = {}
): Promise<Record<string, string> | undefined> {
  const spawn = vi.fn(
    async (_args: {
      env?: Record<string, string>
      worktreeId?: string
      tabId?: string
      leafId?: string
    }) => ({ id: 'pty-1' })
  )
  const { runtimeStore } = makeRuntimeStoreWithWorkspaceSession(getDefaultWorkspaceSession())
  const settings = runtimeStore.getSettings()
  const runtime = new OrcaRuntimeService({
    ...runtimeStore,
    getSettings: () => ({ ...settings, terminalShellEditor })
  } as typeof runtimeStore)
  runtime.setPtyController({
    spawn: committingSpawn(runtime, spawn),
    write: () => true,
    kill: () => true,
    getForegroundProcess: async () => null
  })
  await runtime.createTerminal(`id:${TEST_WORKTREE_ID}`, opts)
  return spawn.mock.calls[0]?.[0].env
}

describe.skipIf(process.platform === 'win32')('main terminals ask for the shell editor', () => {
  it('for a plain shell when the setting is on', async () => {
    expect(await spawnedEnv(true)).toMatchObject({ ORCA_SHELL_EDITOR: '1' })
  })

  it('for a setup command', async () => {
    expect(await spawnedEnv(true, { command: 'bash setup-runner.sh' })).toMatchObject({
      ORCA_SHELL_EDITOR: '1'
    })
  })

  it('not for an agent', async () => {
    expect(
      (await spawnedEnv(true, { command: 'claude --permission-mode plan' }))?.ORCA_SHELL_EDITOR
    ).toBeUndefined()
  })

  it('not when the setting is off', async () => {
    expect((await spawnedEnv(false))?.ORCA_SHELL_EDITOR).toBeUndefined()
  })
})
