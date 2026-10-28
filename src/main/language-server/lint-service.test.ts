import { describe, expect, it, vi } from 'vitest'
import type { LintDiagnostic } from '../../shared/linter'
import { createLintService } from './lint-service'
import type { LinterLaunch } from './linter-launch'

const exists = (path: string): boolean =>
  ['/wt/.oxlintrc.json', '/wt/node_modules/.bin/oxlint'].includes(path)

const request = (filePath: string, text = 'x') => ({
  linter: 'oxlint' as const,
  command: null,
  filePath,
  worktreeRoot: '/wt',
  repoRoot: null,
  text
})

const diagnostic: LintDiagnostic = {
  line: 0,
  character: 0,
  endLine: 0,
  endCharacter: 1,
  severity: 2,
  message: 'no'
}

function setup() {
  const sessions: {
    launch: LinterLaunch
    publish: (filePath: string, diagnostics: LintDiagnostic[]) => void
    open: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  const onDiagnostics = vi.fn()
  const service = createLintService({
    exists,
    onDiagnostics,
    startSession: (launch, publish) => {
      const session = {
        launch,
        publish,
        closed: false,
        open: vi.fn(async () => undefined),
        close: vi.fn(),
        dispose: vi.fn()
      }
      sessions.push(session)
      return session
    }
  })
  return { service, sessions, onDiagnostics }
}

describe('lint service', () => {
  it("lints every file of a project through one server and tags what it reports with the linter's name", async () => {
    const { service, sessions, onDiagnostics } = setup()

    await service.sync(request('/wt/src/a.ts', 'one'))
    await service.sync(request('/wt/src/b.ts', 'two'))
    sessions[0].publish('/wt/src/a.ts', [diagnostic])

    expect(sessions).toHaveLength(1)
    expect(sessions[0].launch.projectRoot).toBe('/wt')
    expect(sessions[0].open.mock.calls).toEqual([
      ['/wt/src/a.ts', 'one'],
      ['/wt/src/b.ts', 'two']
    ])
    expect(onDiagnostics).toHaveBeenCalledWith({
      linter: 'oxlint',
      filePath: '/wt/src/a.ts',
      diagnostics: [diagnostic]
    })
  })

  it('starts nothing for a project without the linter', async () => {
    const { service, sessions } = setup()

    await service.sync({ ...request('/elsewhere/a.ts'), worktreeRoot: '/elsewhere' })

    expect(sessions).toHaveLength(0)
  })

  it('closes a file in the server that opened it', async () => {
    const { service, sessions } = setup()
    await service.sync(request('/wt/src/a.ts'))

    service.close({ linter: 'oxlint', filePath: '/wt/src/a.ts' })

    expect(sessions[0].close).toHaveBeenCalledWith('/wt/src/a.ts')
  })

  it('stops a linter and the servers inside a removed folder', async () => {
    const { service, sessions } = setup()
    await service.sync(request('/wt/src/a.ts'))

    service.stopUnder('/wt')
    service.stopLinter('oxlint')

    expect(sessions[0].dispose).toHaveBeenCalledOnce()
  })
})
