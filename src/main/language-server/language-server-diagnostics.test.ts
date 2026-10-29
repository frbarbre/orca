import { describe, expect, it, vi } from 'vitest'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import { createLanguageServerService } from './language-server-service'

const finding = (line: number, code = 'unused-call-result'): EditorDiagnostic => ({
  line,
  character: 0,
  endLine: line,
  endCharacter: 4,
  severity: 1,
  code,
  message: code
})

const pythonFile = {
  language: 'python' as const,
  server: 'pyrefly',
  command: null,
  filePath: '/repo/apps/backend/a.py',
  worktreeRoot: '/repo',
  repoRoot: '/repo',
  venvSetting: null,
  text: 'save(user)\nother()'
}

const tsFile = (name: string) => ({
  ...pythonFile,
  language: 'typescript' as const,
  server: 'tsgo',
  filePath: `/repo/apps/frontend/src/${name}`,
  text: `text of ${name}`
})

const baseline = '/repo/apps/backend/.hemolint/pyrefly-unused-call-result/a.py.json'

function setup() {
  const sessions: {
    publish: (filePath: string, diagnostics: EditorDiagnostic[]) => void
    open: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    pullDiagnostics: ReturnType<typeof vi.fn>
  }[] = []
  const onDiagnostics = vi.fn()
  let diskChanged: () => void = () => {}
  const service = createLanguageServerService({
    readPreview: () => null,
    readFile: (path) => (path === baseline ? JSON.stringify({ 'save(user)': 1 }) : null),
    exists: (path) =>
      [
        '/repo/apps/backend/pyproject.toml',
        '/repo/apps/backend/.venv/bin/pyrefly',
        '/repo/apps/backend/.hemolint',
        baseline,
        '/repo/apps/frontend/tsconfig.json',
        '/repo/apps/frontend/node_modules/.bin/tsgo'
      ].includes(path),
    onDiagnostics,
    watchFiles: (_root, onChanges) => {
      diskChanged = () =>
        onChanges([{ filePath: '/repo/apps/frontend/src/lib.ts', type: 'update' }])
      return () => undefined
    },
    startSession: (launch, publish) => {
      const opened = new Set<string>()
      const session = {
        closed: false,
        dispose: vi.fn(),
        filesChanged: vi.fn(),
        definition: vi.fn(),
        hover: vi.fn(),
        references: vi.fn(),
        completion: vi.fn(),
        resolveCompletion: vi.fn(),
        codeActions: vi.fn(),
        organizeImports: vi.fn(),
        publish,
        open: vi.fn(async (filePath: string) => {
          opened.add(filePath)
        }),
        close: vi.fn((filePath: string) => {
          opened.delete(filePath)
        }),
        pullDiagnostics: vi.fn(async (filePath: string) =>
          launch.language === 'typescript' && opened.has(filePath)
            ? [finding(filePath.endsWith('a.ts') ? 1 : 2, '2322')]
            : null
        )
      }
      sessions.push(session)
      return session
    }
  })
  return { service, sessions, onDiagnostics, diskChanged: () => diskChanged() }
}

describe('language server diagnostics', () => {
  it("shows a pulling server's errors for a file, and checks the other open files again", async () => {
    const { service, onDiagnostics } = setup()

    await service.sync(tsFile('a.ts'))
    await service.sync(tsFile('b.ts'))

    expect(onDiagnostics.mock.calls.map(([event]) => [event.source, event.filePath])).toEqual([
      ['typescript', '/repo/apps/frontend/src/a.ts'],
      ['typescript', '/repo/apps/frontend/src/b.ts'],
      ['typescript', '/repo/apps/frontend/src/a.ts']
    ])
    expect(onDiagnostics).toHaveBeenCalledWith({
      source: 'typescript',
      filePath: '/repo/apps/frontend/src/b.ts',
      diagnostics: [finding(2, '2322')]
    })
  })

  it('checks the open files again after something changes on disk', async () => {
    const { service, onDiagnostics, diskChanged } = setup()
    await service.sync(tsFile('a.ts'))
    onDiagnostics.mockClear()

    diskChanged()
    await vi.waitFor(() => expect(onDiagnostics).toHaveBeenCalledOnce())

    expect(onDiagnostics.mock.calls[0][0].filePath).toBe('/repo/apps/frontend/src/a.ts')
  })

  it("passes on what a publishing server reports, less what the project's hemolint baseline accepts", async () => {
    const { service, sessions, onDiagnostics } = setup()
    await service.sync(pythonFile)

    sessions[0].publish(pythonFile.filePath, [finding(0), finding(1)])

    expect(onDiagnostics).toHaveBeenCalledWith({
      source: 'python',
      filePath: pythonFile.filePath,
      diagnostics: [finding(1)]
    })
  })

  it('stops reporting a file once it is closed', async () => {
    const { service, sessions, onDiagnostics } = setup()
    await service.sync(pythonFile)

    service.closeDocument({ language: 'python', filePath: pythonFile.filePath })
    sessions[0].publish(pythonFile.filePath, [finding(1)])

    expect(sessions[0].close).toHaveBeenCalledWith(pythonFile.filePath)
    expect(onDiagnostics).not.toHaveBeenCalled()
  })
})
