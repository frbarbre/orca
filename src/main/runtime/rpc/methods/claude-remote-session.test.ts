import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'

const lookup = vi.hoisted(() => ({ resolve: vi.fn() }))
vi.mock('../../../claude/claude-remote-session-url', () => ({
  resolveClaudeRemoteSessionUrl: lookup.resolve
}))

import { CLAUDE_REMOTE_SESSION_METHODS } from './claude-remote-session'

function call(method: string, params?: Record<string, unknown>) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler never touches the runtime.
  const dispatcher = new RpcDispatcher({
    runtime: { getRuntimeId: () => 'test-runtime' } as unknown as OrcaRuntimeService,
    methods: CLAUDE_REMOTE_SESSION_METHODS
  })
  return dispatcher.dispatch({ id: 'req-1', authToken: 'tok', method, params })
}

describe('claude remote session RPC', () => {
  it("resolves the session's claude.ai link on the machine running it", async () => {
    lookup.resolve.mockResolvedValue({ status: 'ready', url: 'https://claude.ai/code/session_1' })

    const response = await call('claudeRemoteSession.resolveUrl', { sessionId: 'abc' })

    expect(lookup.resolve).toHaveBeenCalledWith('abc')
    expect(response).toMatchObject({
      ok: true,
      result: { status: 'ready', url: 'https://claude.ai/code/session_1' }
    })
  })
})
