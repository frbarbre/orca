import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSshClaudeRemoteSessionUrl } from './claude-remote-session-url-ssh'

const { platform, connection } = vi.hoisted(() => ({
  platform: { os: 'linux' as 'linux' | 'win32' },
  connection: { current: {} as object | undefined }
}))
let home: string

// Why a real shell: the lookup is a script run on the SSH host, so the test runs that script.
vi.mock('../ssh/remote-exec/remote-exec-command', () => ({
  execCommand: async (_conn: unknown, command: string) =>
    (
      await promisify(execFile)('/bin/sh', ['-c', command], {
        env: { PATH: process.env.PATH, HOME: home }
      })
    ).stdout
}))
vi.mock('../ssh/targets/ssh-target-registry', () => ({
  getSshConnectionManager: () => ({ getConnection: () => connection.current })
}))
vi.mock('../ssh/ssh-host-platform-memo', () => ({
  knownSshHostPlatform: () => ({ os: platform.os, arch: 'x64', libc: 'glibc' })
}))

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'orca-claude-remote-ssh-'))
  await mkdir(join(home, '.claude', 'sessions'), { recursive: true })
  platform.os = 'linux'
  connection.current = {}
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

async function writeSession(pid: number, record: Record<string, unknown>): Promise<void> {
  await writeFile(join(home, '.claude', 'sessions', `${pid}.json`), JSON.stringify(record, null, 2))
}

describe.skipIf(process.platform === 'win32')('resolveSshClaudeRemoteSessionUrl', () => {
  it("reads the session's newest process file on the SSH host", async () => {
    await writeSession(1, { sessionId: 'other', bridgeSessionId: 'session_01Other', updatedAt: 9 })
    await writeSession(2, { sessionId: 'abc', bridgeSessionId: 'session_01Old', updatedAt: 1 })
    await writeSession(3, { sessionId: 'abc', bridgeSessionId: 'session_01New', updatedAt: 5 })

    await expect(resolveSshClaudeRemoteSessionUrl('box', 'abc')).resolves.toEqual({
      status: 'ready',
      url: 'https://claude.ai/code/session_01New'
    })
  })

  it('reports not found when nothing matches, the host is Windows, or it is disconnected', async () => {
    await expect(resolveSshClaudeRemoteSessionUrl('box', 'abc')).resolves.toEqual({
      status: 'session-not-found'
    })
    await writeSession(1, { sessionId: 'abc', bridgeSessionId: 'session_01Abc' })
    platform.os = 'win32'
    await expect(resolveSshClaudeRemoteSessionUrl('box', 'abc')).resolves.toEqual({
      status: 'session-not-found'
    })
    platform.os = 'linux'
    connection.current = undefined
    await expect(resolveSshClaudeRemoteSessionUrl('box', 'abc')).resolves.toEqual({
      status: 'session-not-found'
    })
  })
})
