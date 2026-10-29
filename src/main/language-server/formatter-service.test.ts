import { describe, expect, it, vi } from 'vitest'
import type { FormatRequest } from '../../shared/formatter'
import { createFormatterService } from './formatter-service'
import type { FormatterLaunch } from './formatter-launch'

const files = {
  exists: (path: string) => ['/wt/.oxfmtrc.json', '/wt/node_modules/.bin/oxfmt'].includes(path),
  read: () => null
}

const request = (filePath: string, text = 'x'): FormatRequest => ({
  formatter: 'oxfmt',
  command: null,
  filePath,
  worktreeRoot: '/wt',
  repoRoot: null,
  venvSetting: null,
  text,
  tabSize: 2,
  insertSpaces: true
})

const edit = { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 1, text: 'y' }

function setup(format: () => Promise<(typeof edit)[]> = async () => [edit]) {
  const sessions: {
    launch: FormatterLaunch
    format: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  const service = createFormatterService({
    files,
    startSession: (launch) => {
      const session = {
        launch,
        closed: false,
        format: vi.fn(format),
        close: vi.fn(),
        dispose: vi.fn()
      }
      sessions.push(session)
      return session
    }
  })
  return { service, sessions }
}

describe('formatter service', () => {
  it("formats every file of a project through one server and returns the server's edits", async () => {
    const { service, sessions } = setup()

    const first = await service.format(request('/wt/src/a.ts', 'one'))
    const second = await service.format(request('/wt/src/b.css', 'two'))

    expect([first, second]).toEqual([
      { ok: true, edits: [edit] },
      { ok: true, edits: [edit] }
    ])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].launch.program).toBe('/wt/node_modules/.bin/oxfmt')
    expect(sessions[0].format).toHaveBeenLastCalledWith({
      filePath: '/wt/src/b.css',
      text: 'two',
      tabSize: 2,
      insertSpaces: true
    })
  })

  it('closes the file after formatting it, so the server keeps no stale copy', async () => {
    const { service, sessions } = setup()

    await service.format(request('/wt/src/a.ts'))

    expect(sessions[0].close).toHaveBeenCalledWith('/wt/src/a.ts')
    expect(sessions[0].format.mock.invocationCallOrder[0]).toBeLessThan(
      sessions[0].close.mock.invocationCallOrder[0]
    )
    expect(sessions[0].dispose).not.toHaveBeenCalled()
  })

  it('leaves a file alone that no configured formatter covers', async () => {
    const { service, sessions } = setup()

    expect(
      await service.format({ ...request('/elsewhere/a.ts'), worktreeRoot: '/elsewhere' })
    ).toEqual({ ok: true, edits: [] })
    expect(await service.format({ ...request('relative/a.ts') })).toEqual({ ok: true, edits: [] })
    expect(sessions).toHaveLength(0)
  })

  it('reports a server that fails', async () => {
    const { service } = setup(async () => {
      throw new Error('oxfmt exited')
    })

    expect(await service.format(request('/wt/src/a.ts'))).toEqual({
      ok: false,
      error: 'oxfmt exited'
    })
  })

  it("stops a formatter's servers when it is switched off", async () => {
    const { service, sessions } = setup()
    await service.format(request('/wt/src/a.ts'))

    service.stopFormatter('ruff')
    expect(sessions[0].dispose).not.toHaveBeenCalled()
    service.stopFormatter('oxfmt')
    expect(sessions[0].dispose).toHaveBeenCalledOnce()
  })
})
