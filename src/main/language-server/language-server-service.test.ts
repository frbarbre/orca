import { describe, expect, it, vi } from 'vitest'
import { createLanguageServerService } from './language-server-service'

const request = {
  language: 'python' as const,
  server: 'pyrefly',
  command: null,
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
  server: 'tsgo',
  filePath: '/repo/apps/frontend/src/a.tsx'
}

type ServiceOptions = Parameters<typeof createLanguageServerService>[0]

function setup(watchFiles?: ServiceOptions['watchFiles'], admit?: ServiceOptions['admit']) {
  const definition = vi.fn(async () => [
    { filePath: '/repo/apps/backend/b.py', line: 0, character: 0 }
  ])
  const hover = vi.fn(async () => '```python\nx: int\n```')
  const references = vi.fn(async () => [
    { filePath: '/repo/apps/backend/a.py', line: 19, character: 6 },
    { filePath: '/repo/apps/backend/c.py', line: 4, character: 10 },
    { filePath: '/repo/apps/backend/c.py', line: 9, character: 10 }
  ])
  const sessions: { dispose: ReturnType<typeof vi.fn>; filesChanged: ReturnType<typeof vi.fn> }[] =
    []
  const startSession = vi.fn(() => {
    const session = {
      closed: false,
      dispose: vi.fn(),
      filesChanged: vi.fn(),
      definition,
      hover,
      references,
      open: vi.fn(async () => undefined),
      close: vi.fn(),
      pullDiagnostics: vi.fn(async () => null)
    }
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
    startSession,
    ...(watchFiles ? { watchFiles } : {}),
    ...(admit ? { admit } : {})
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
      expect.objectContaining({ program: '/repo/apps/backend/.venv/bin/pyrefly' }),
      expect.any(Function)
    )
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/wt/e-5139/apps/frontend',
        program: '/repo/apps/frontend/node_modules/.bin/tsgo'
      }),
      expect.any(Function)
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
    expect(startSession).toHaveBeenCalledWith(
      {
        language: 'python',
        serverName: 'pyrefly',
        projectRoot: '/repo/apps/backend',
        program: '/repo/apps/backend/.venv/bin/pyrefly',
        args: ['lsp'],
        env: { VIRTUAL_ENV: '/repo/apps/backend/.venv' },
        pathPrefix: ['/repo/apps/backend/.venv/bin']
      },
      expect.any(Function)
    )
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
    expect(startSession).toHaveBeenCalledWith(
      {
        language: 'typescript',
        serverName: 'tsgo',
        projectRoot: '/repo/apps/frontend',
        program: '/repo/apps/frontend/node_modules/.bin/tsgo',
        args: ['--lsp', '--stdio'],
        env: {},
        pathPrefix: []
      },
      expect.any(Function)
    )
  })

  it("asks the worktree's last server about a file outside it, like a bundled typeshed stub", async () => {
    const { service, startSession, definition } = setup()
    await service.definition(request)

    const stub = '/var/folders/x/pyrefly_bundled_typeshed/typing.pyi'
    await service.hover({ ...request, filePath: stub })
    expect(startSession).toHaveBeenCalledTimes(1)
    expect(startSession).toHaveBeenCalledWith(
      expect.objectContaining({ projectRoot: '/repo/apps/backend' }),
      expect.any(Function)
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

  it("watches each server's project and passes its disk changes on until the server stops", async () => {
    const stopWatching = vi.fn()
    let onChanges: (changes: { filePath: string; type: 'update' }[]) => void = () => undefined
    const watchFiles = vi.fn((_root: string, listener: typeof onChanges) => {
      onChanges = listener
      return stopWatching
    })
    const { service, sessions } = setup(watchFiles)
    await service.definition(request)

    expect(watchFiles).toHaveBeenCalledWith('/repo/apps/backend', expect.any(Function))
    onChanges([{ filePath: '/repo/apps/backend/b.py', type: 'update' }])
    expect(sessions[0]?.filesChanged).toHaveBeenCalledWith([
      { filePath: '/repo/apps/backend/b.py', type: 'update' }
    ])

    service.stopLanguage('python')
    expect(sessions[0]?.dispose).toHaveBeenCalled()
    expect(stopWatching).toHaveBeenCalled()
  })

  it('stops the servers inside a worktree being removed, and only those', async () => {
    const { service, sessions } = setup()
    await service.definition(request)
    await service.definition({
      ...request,
      filePath: '/wt/e-5139/apps/backend/a.py',
      worktreeRoot: '/wt/e-5139'
    })

    service.stopUnder('/wt/e-5139')

    expect(sessions[1]?.dispose).toHaveBeenCalled()
    expect(sessions[0]?.dispose).not.toHaveBeenCalled()
  })

  it('holds a removal fence on its project while it runs, and starts none while it is removed', async () => {
    const release = vi.fn()
    const admit = vi.fn((_root: string) => release)
    const { service, sessions, startSession } = setup(undefined, admit)

    await service.definition(request)
    expect(admit).toHaveBeenCalledWith('/repo/apps/backend')
    service.stopUnder('/repo')
    expect(sessions[0]?.dispose).toHaveBeenCalled()
    expect(release).toHaveBeenCalled()

    admit.mockImplementation(() => {
      throw new Error('This workspace is being removed.')
    })
    await expect(service.definition(request)).resolves.toEqual({
      ok: false,
      error: 'This workspace is being removed.'
    })
    expect(startSession).toHaveBeenCalledTimes(1)
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
