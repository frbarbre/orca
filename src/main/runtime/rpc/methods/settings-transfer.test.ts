import '../unused-default-rpc-methods.test-fixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'

const relay = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../../host/settings-transfer-cli-port', () => ({
  requestSettingsTransfer: relay.request
}))

import { SETTINGS_TRANSFER_METHODS } from './settings-transfer'

function call(method: string, params?: Record<string, unknown>) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers never touch the runtime.
  const dispatcher = new RpcDispatcher({
    runtime: { getRuntimeId: () => 'test-runtime' } as unknown as OrcaRuntimeService,
    methods: SETTINGS_TRANSFER_METHODS
  })
  return dispatcher.dispatch({ id: 'req-1', authToken: 'tok', method, params })
}

describe('settings transfer RPC', () => {
  beforeEach(() => relay.request.mockReset())

  it("exports through the window's settings export", async () => {
    relay.request.mockResolvedValue({ text: '{"format":"orca-settings"}' })

    const response = await call('settingsTransfer.export')

    expect(relay.request).toHaveBeenCalledWith({ kind: 'export' })
    expect(response).toMatchObject({ ok: true, result: { text: '{"format":"orca-settings"}' } })
  })

  it("imports through the window's settings import", async () => {
    relay.request.mockResolvedValue({ summary: '3 settings' })

    const response = await call('settingsTransfer.import', { text: '{}' })

    expect(relay.request).toHaveBeenCalledWith({ kind: 'import', text: '{}' })
    expect(response).toMatchObject({ ok: true, result: { summary: '3 settings' } })
  })
})
