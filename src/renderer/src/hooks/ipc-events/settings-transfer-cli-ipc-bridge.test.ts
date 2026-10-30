import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  buildSettingsExportText: vi.fn(async () => '{"format":"orca-settings"}'),
  applySettingsImport: vi.fn(async () => {}),
  describeSettingsBundle: vi.fn(() => '3 settings')
}))
vi.mock('@/lib/settings-transfer-actions', () => actions)

const parse = vi.hoisted(() => ({ result: { ok: true, bundle: { settings: {} } } as unknown }))
vi.mock('../../../../shared/settings-transfer', () => ({
  parseSettingsTransfer: () => parse.result
}))

import { answerSettingsTransferCliRequest } from './settings-transfer-cli-ipc-bridge'

const reply = vi.fn()
const reload = vi.fn()

describe('settings transfer CLI requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    parse.result = { ok: true, bundle: { settings: {} } }
    vi.stubGlobal('window', {
      api: { settingsTransfer: { replyCliRequest: reply } },
      location: { reload }
    })
  })

  it('answers an export with the same bundle the Settings screen exports', async () => {
    await answerSettingsTransferCliRequest({ requestId: 'r1', kind: 'export' })

    expect(reply).toHaveBeenCalledWith({ requestId: 'r1', text: '{"format":"orca-settings"}' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('applies an import, answers with what it replaced, then reloads', async () => {
    await answerSettingsTransferCliRequest({ requestId: 'r2', kind: 'import', text: '{}' })

    expect(actions.applySettingsImport).toHaveBeenCalledWith({ settings: {} })
    expect(reply).toHaveBeenCalledWith({ requestId: 'r2', summary: '3 settings' })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('answers with the parse error and changes nothing for an invalid file', async () => {
    parse.result = { ok: false, error: 'The file is not valid JSON.' }

    await answerSettingsTransferCliRequest({ requestId: 'r3', kind: 'import', text: 'nope' })

    expect(actions.applySettingsImport).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalledWith({ requestId: 'r3', error: 'The file is not valid JSON.' })
    expect(reload).not.toHaveBeenCalled()
  })
})
