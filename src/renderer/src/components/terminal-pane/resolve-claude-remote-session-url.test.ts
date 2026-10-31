import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callRuntimeRpc: vi.fn(), resolveUrl: vi.fn() }))
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))

import { resolveClaudeRemoteSessionUrlForHost } from './resolve-claude-remote-session-url'

describe('resolveClaudeRemoteSessionUrlForHost', () => {
  beforeEach(() => {
    mocks.callRuntimeRpc.mockReset()
    mocks.resolveUrl.mockReset()
    vi.stubGlobal('window', { api: { claudeRemoteSession: { resolveUrl: mocks.resolveUrl } } })
  })

  it('asks the paired Orca for a session running on it', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ status: 'ready', url: 'https://claude.ai/x' })

    const result = await resolveClaudeRemoteSessionUrlForHost('abc', 'runtime:env-1')

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'claudeRemoteSession.resolveUrl',
      { sessionId: 'abc' }
    )
    expect(mocks.resolveUrl).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'ready', url: 'https://claude.ai/x' })
  })

  it('looks up local and SSH sessions through this Orca', async () => {
    mocks.resolveUrl.mockResolvedValue({ status: 'session-not-found' })

    await resolveClaudeRemoteSessionUrlForHost('abc', 'ssh:box')
    await resolveClaudeRemoteSessionUrlForHost('abc', null)

    expect(mocks.resolveUrl).toHaveBeenNthCalledWith(1, { sessionId: 'abc', hostId: 'ssh:box' })
    expect(mocks.resolveUrl).toHaveBeenNthCalledWith(2, { sessionId: 'abc' })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })
})
