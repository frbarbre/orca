import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }

  class RuntimeClientError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }

  class RuntimeRpcFailureError extends RuntimeClientError {
    readonly response: unknown

    constructor(response: unknown) {
      super('runtime_error', 'runtime_error')
      this.response = response
    }
  }

  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { okFixture, queueFixtures } from '../test-fixtures'

const BUNDLE = '{\n  "format": "orca-settings"\n}'

describe('orca settings export and import', () => {
  let dir: string

  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.exitCode = undefined
    dir = mkdtempSync(join(tmpdir(), 'orca-settings-cli-'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('writes the exported settings to --output', async () => {
    queueFixtures(callMock, okFixture('req_export', { text: BUNDLE }))
    const output = join(dir, 'orca-settings.json')

    await main(['settings', 'export', '--output', output], dir)

    expect(callMock.mock.calls[0][0]).toBe('settingsTransfer.export')
    expect(readFileSync(output, 'utf8')).toBe(`${BUNDLE}\n`)
    expect(process.exitCode).toBeUndefined()
  })

  it('prints the exported settings without --output', async () => {
    queueFixtures(callMock, okFixture('req_export', { text: BUNDLE }))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['settings', 'export'], dir)

    expect(log).toHaveBeenCalledWith(BUNDLE)
  })

  it('imports the settings file into the running Orca', async () => {
    const file = join(dir, 'shared.json')
    writeFileSync(file, BUNDLE)
    queueFixtures(callMock, okFixture('req_import', { summary: '12 settings, keybindings' }))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['settings', 'import', '--file', file], dir)

    expect(callMock).toHaveBeenCalledWith('settingsTransfer.import', { text: BUNDLE })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('12 settings, keybindings'))
    expect(process.exitCode).toBeUndefined()
  })
})
