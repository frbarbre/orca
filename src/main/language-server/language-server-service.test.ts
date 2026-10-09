import { describe, expect, it, vi } from 'vitest'
import { createLanguageServerService } from './language-server-service'

const request = {
  language: 'python' as const,
  filePath: '/repo/apps/backend/a.py',
  worktreeRoot: '/repo',
  repoRoot: '/repo',
  venvSetting: null,
  text: 'import b',
  line: 0,
  character: 7
}

const tsRequest = {
  ...request,
  language: 'typescript' as const,
  filePath: '/repo/apps/frontend/src/a.tsx'
}

function setup() {
  const definition = vi.fn(async () => [
    { filePath: '/repo/apps/backend/b.py', line: 0, character: 0 }
  ])
  const hover = vi.fn(async () => '```python\nx: int\n```')
  const sessions: { dispose: ReturnType<typeof vi.fn> }[] = []
  const startSession = vi.fn(() => {
    const session = { closed: false, dispose: vi.fn(), definition, hover }
    sessions.push(session)
    return session
  })
  const service = createLanguageServerService({
    exists: (path) =>
      path === '/repo/apps/backend/pyproject.toml' ||
      path === '/wt/e-5139/apps/backend/pyproject.toml' ||
      path === '/wt/e-5139/apps/frontend/tsconfig.json' ||
      path === '/repo/apps/backend/.venv/bin/pyrefly' ||
      path === '/repo/apps/frontend/tsconfig.json' ||
      path === '/repo/apps/frontend/node_modules/.bin/tsgo',
    startSession
  })
  return { service, startSession, definition, hover, sessions }
}

describe('language server service', () => {
  it("runs a bare worktree on the main checkout's venv and tsgo", async () => {
    const { service, startSession } = setup()
    const bare = { worktreeRoot: '/wt/e-5139' }

    await service.definition({ ...request, ...bare, filePath: '/wt/e-5139/apps/backend/a.py' })
    await service.definition({
      ...tsRequest,
      ...bare,
      filePath: '/wt/e-5139/apps/frontend/src/a.ts'
    })
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ program: '/repo/apps/backend/.venv/bin/pyrefly' })
    )
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/wt/e-5139/apps/frontend',
        program: '/repo/apps/frontend/node_modules/.bin/tsgo'
      })
    )
  })

  it('answers hovers from the same server as definitions', async () => {
    const { service, startSession, hover } = setup()

    await service.definition(request)
    await expect(service.hover(request)).resolves.toEqual({
      ok: true,
      markdown: '```python\nx: int\n```'
    })
    expect(startSession).toHaveBeenCalledTimes(1)
    expect(hover).toHaveBeenCalledWith({
      filePath: '/repo/apps/backend/a.py',
      text: 'import b',
      line: 0,
      character: 7
    })
  })

  it("starts one pyrefly per project, in the project's venv, and reuses it", async () => {
    const { service, startSession, definition } = setup()

    await expect(service.definition(request)).resolves.toEqual({
      ok: true,
      locations: [{ filePath: '/repo/apps/backend/b.py', line: 0, character: 0 }]
    })
    await service.definition({ ...request, filePath: '/repo/apps/backend/c.py' })

    expect(startSession).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledWith({
      language: 'python',
      serverName: 'pyrefly',
      projectRoot: '/repo/apps/backend',
      program: '/repo/apps/backend/.venv/bin/pyrefly',
      args: ['lsp'],
      venvPath: '/repo/apps/backend/.venv'
    })
    expect(definition).toHaveBeenLastCalledWith({
      filePath: '/repo/apps/backend/c.py',
      text: 'import b',
      line: 0,
      character: 7
    })
  })

  it("starts tsgo's language server for TypeScript, from the project's node_modules", async () => {
    const { service, startSession } = setup()

    await service.definition(tsRequest)
    await service.hover({ ...tsRequest, filePath: '/repo/apps/frontend/src/b.ts' })

    expect(startSession).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledWith({
      language: 'typescript',
      serverName: 'tsgo',
      projectRoot: '/repo/apps/frontend',
      program: '/repo/apps/frontend/node_modules/.bin/tsgo',
      args: ['--lsp', '--stdio'],
      venvPath: null
    })
  })

  it("stops one language's servers and leaves the other running", async () => {
    const { service, sessions } = setup()
    await service.definition(request)
    await service.definition(tsRequest)

    service.stopLanguage('typescript')
    expect(sessions[1]?.dispose).toHaveBeenCalled()
    expect(sessions[0]?.dispose).not.toHaveBeenCalled()
  })

  it('refuses files at a relative path or of the wrong language', async () => {
    const { service, startSession } = setup()

    const relative = await service.definition({ ...request, filePath: 'apps/a.py' })
    const tsAsPython = await service.definition({ ...request, filePath: '/repo/a.ts' })
    const pyAsTs = await service.definition({ ...tsRequest, filePath: '/repo/a.py' })
    expect([relative.ok, tsAsPython.ok, pyAsTs.ok]).toEqual([false, false, false])
    expect(startSession).not.toHaveBeenCalled()
  })

  it('reports a server failure instead of throwing', async () => {
    const { service, definition } = setup()
    definition.mockRejectedValueOnce(new Error('pyrefly exited'))

    await expect(service.definition(request)).resolves.toEqual({
      ok: false,
      error: 'pyrefly exited'
    })
  })
})
