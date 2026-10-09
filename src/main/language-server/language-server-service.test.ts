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
  const references = vi.fn(async () => [
    { filePath: '/repo/apps/backend/a.py', line: 19, character: 6 },
    { filePath: '/repo/apps/backend/c.py', line: 4, character: 10 },
    { filePath: '/repo/apps/backend/c.py', line: 9, character: 10 }
  ])
  const sessions: { dispose: ReturnType<typeof vi.fn> }[] = []
  const startSession = vi.fn(() => {
    const session = { closed: false, dispose: vi.fn(), definition, hover, references }
    sessions.push(session)
    return session
  })
  const readPreview = vi.fn((_filePath: string, _line: number): string | null => null)
  const readFile = vi.fn((filePath: string): string | null => `text of ${filePath}`)
  const service = createLanguageServerService({
    readPreview,
    readFile,
    exists: (path) =>
      path === '/repo/apps/backend/pyproject.toml' ||
      path === '/wt/e-5139/apps/backend/pyproject.toml' ||
      path === '/wt/e-5139/apps/frontend/tsconfig.json' ||
      path === '/repo/apps/backend/.venv/bin/pyrefly' ||
      path === '/repo/apps/frontend/tsconfig.json' ||
      path === '/repo/apps/frontend/node_modules/.bin/tsgo',
    startSession
  })
  return { service, startSession, definition, hover, references, sessions, readPreview, readFile }
}

describe('language server service', () => {
  it('finds references with the text of each other file they are in, for the peek view', async () => {
    const { service, readFile } = setup()

    await expect(service.references(request)).resolves.toEqual({
      ok: true,
      locations: [
        { filePath: '/repo/apps/backend/a.py', line: 19, character: 6 },
        { filePath: '/repo/apps/backend/c.py', line: 4, character: 10 },
        { filePath: '/repo/apps/backend/c.py', line: 9, character: 10 }
      ],
      files: { '/repo/apps/backend/c.py': 'text of /repo/apps/backend/c.py' }
    })
    expect(readFile).toHaveBeenCalledTimes(1)
  })

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

  it("sends the target's lines with each definition, for the Cmd+hover preview", async () => {
    const { service, readPreview } = setup()
    readPreview.mockReturnValue('def b():\n    pass')

    await expect(service.definition(request)).resolves.toEqual({
      ok: true,
      locations: [
        {
          filePath: '/repo/apps/backend/b.py',
          line: 0,
          character: 0,
          preview: 'def b():\n    pass'
        }
      ]
    })
    expect(readPreview).toHaveBeenCalledWith('/repo/apps/backend/b.py', 0)
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

  it("asks the worktree's last server about a file outside it, like a bundled typeshed stub", async () => {
    const { service, startSession, definition } = setup()
    await service.definition(request)

    const stub = '/var/folders/x/pyrefly_bundled_typeshed/typing.pyi'
    await service.hover({ ...request, filePath: stub })
    expect(startSession).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: '/repo/apps/backend' })
    )
    expect(definition).toHaveBeenCalledTimes(1)
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
