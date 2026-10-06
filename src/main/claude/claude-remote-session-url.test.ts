import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveClaudeRemoteSessionUrl } from './claude-remote-session-url'

let configDir: string

async function writeSession(pid: number, record: Record<string, unknown> | string): Promise<void> {
  await writeFile(
    join(configDir, 'sessions', `${pid}.json`),
    typeof record === 'string' ? record : JSON.stringify(record)
  )
}

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'orca-claude-remote-'))
  await mkdir(join(configDir, 'sessions'))
})

afterEach(async () => {
  await rm(configDir, { recursive: true, force: true })
})

describe('resolveClaudeRemoteSessionUrl', () => {
  it('builds the claude.ai URL from the bridge session of the matching process', async () => {
    await writeSession(1, { sessionId: 'other', bridgeSessionId: 'session_01Other' })
    await writeSession(2, { sessionId: 'abc', bridgeSessionId: 'session_01Abc', updatedAt: 5 })

    await expect(resolveClaudeRemoteSessionUrl('abc', configDir)).resolves.toEqual({
      status: 'ready',
      url: 'https://claude.ai/code/session_01Abc'
    })
  })

  it('prefers the most recently updated file when a session has several', async () => {
    await writeSession(1, { sessionId: 'abc', bridgeSessionId: 'session_01Old', updatedAt: 1 })
    await writeSession(2, { sessionId: 'abc', bridgeSessionId: 'session_01New', updatedAt: 9 })

    await expect(resolveClaudeRemoteSessionUrl('abc', configDir)).resolves.toEqual({
      status: 'ready',
      url: 'https://claude.ai/code/session_01New'
    })
  })

  it('reports Remote Control off, with when the session started, when there is no bridge', async () => {
    await writeSession(1, { sessionId: 'abc', startedAt: 1234 })
    await expect(resolveClaudeRemoteSessionUrl('abc', configDir)).resolves.toEqual({
      status: 'remote-control-off',
      startedAt: 1234
    })
  })

  it('rejects a bridge id that is not a plain session id', async () => {
    await writeSession(1, { sessionId: 'abc', bridgeSessionId: '../../evil?x=1' })
    await expect(resolveClaudeRemoteSessionUrl('abc', configDir)).resolves.toEqual({
      status: 'remote-control-off',
      startedAt: 0
    })
  })

  it('skips unreadable files and reports a missing session', async () => {
    await writeSession(1, 'not json')
    await expect(resolveClaudeRemoteSessionUrl('abc', configDir)).resolves.toEqual({
      status: 'session-not-found'
    })
    await expect(resolveClaudeRemoteSessionUrl('abc', join(configDir, 'missing'))).resolves.toEqual(
      { status: 'session-not-found' }
    )
  })
})
