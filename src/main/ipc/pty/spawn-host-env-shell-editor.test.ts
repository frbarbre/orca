import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import type { IPtyProvider } from '../../providers/pty-provider-contract'
import { noCodexResumeLaunch } from './host-env/codex-resume'
import { resolvePtySpawnHostEnv } from './spawn-host-env'

type Launch = Partial<
  Pick<
    Parameters<typeof resolvePtySpawnHostEnv>[0],
    | 'command'
    | 'launchAgent'
    | 'launchConfig'
    | 'resumeProviderSession'
    | 'connectionId'
    | 'sessionId'
    | 'preAdopted'
  >
>

async function launchEnv(
  terminalShellEditor: boolean,
  launch: Launch = {}
): Promise<Record<string, string> | undefined> {
  const settings = { ...getDefaultSettings('/home/test'), terminalShellEditor }
  const hostEnv = await resolvePtySpawnHostEnv({
    launchAgent: undefined,
    command: undefined,
    resumeProviderSession: undefined,
    connectionId: undefined,
    launchConfig: undefined,
    env: { FOO: 'bar' },
    cwd: '/repo',
    shellOverride: undefined,
    expectedWslDistro: null,
    codexSelectionTarget: { runtime: 'host' },
    preAdopted: false,
    isDaemonHostSpawn: false,
    sessionId: undefined,
    callerNamedSession: launch.sessionId !== undefined,
    mintedSessionId: false,
    resumeOnSelectedAccount: false,
    emptySessionIdSkipsHostEnv: false,
    requestedAgentTeamsPath: undefined,
    provider: {} as IPtyProvider,
    deps: {
      getSettings: () => settings,
      prepareCodexResumeHome: () => null,
      resolveCodexResumeLaunch: async (command) => noCodexResumeLaunch(command),
      noCodexResumeLaunch,
      reconcileSharedRuntimeResumeHome: async () => '',
      stripSequencedStartupResumeArgv: (env) => env
    },
    ...launch
  })
  return hostEnv.env
}

describe.skipIf(process.platform === 'win32')('every new local shell asks for the editor', () => {
  it('a plain shell when the setting is on', async () => {
    expect(await launchEnv(true)).toEqual({ FOO: 'bar', ORCA_SHELL_EDITOR: '1' })
  })

  it('a cold restore under a saved session id', async () => {
    expect(await launchEnv(true, { sessionId: 'wt@@session-1' })).toMatchObject({
      ORCA_SHELL_EDITOR: '1'
    })
  })

  it('a setup command', async () => {
    expect(await launchEnv(true, { command: 'bash setup-runner.sh' })).toMatchObject({
      ORCA_SHELL_EDITOR: '1'
    })
  })

  it('not an agent, a resumed agent, SSH or an adopted pane', async () => {
    const launches: Launch[] = [
      { command: 'claude --permission-mode plan' },
      { launchAgent: 'codex' },
      { resumeProviderSession: { key: 'session_id', id: 's-1' } },
      { connectionId: 'ssh-1' },
      { preAdopted: true }
    ]
    for (const launch of launches) {
      expect((await launchEnv(true, launch))?.ORCA_SHELL_EDITOR).toBeUndefined()
    }
  })

  it('not when the setting is off', async () => {
    expect((await launchEnv(false))?.ORCA_SHELL_EDITOR).toBeUndefined()
  })
})
