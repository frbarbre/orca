import { describe, expect, it, vi } from 'vitest'
import { createPythonDefinitionService } from './python-definition-service'

const request = {
  filePath: '/repo/apps/backend/a.py',
  worktreeRoot: '/repo',
  venvSetting: null,
  text: 'import b',
  line: 0,
  character: 7
}

function setup() {
  const definition = vi.fn(async () => [
    { filePath: '/repo/apps/backend/b.py', line: 0, character: 0 }
  ])
  const hover = vi.fn(async () => '```python\nx: int\n```')
  const startSession = vi.fn(() => ({ closed: false, dispose: vi.fn(), definition, hover }))
  const service = createPythonDefinitionService({
    exists: (path) =>
      path === '/repo/apps/backend/pyproject.toml' ||
      path === '/repo/apps/backend/.venv/bin/pyrefly',
    startSession
  })
  return { service, startSession, definition, hover }
}

describe('python definition service', () => {
  it('answers hovers from the same pyrefly as definitions', async () => {
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
      projectRoot: '/repo/apps/backend',
      venvPath: '/repo/apps/backend/.venv',
      pyrefly: '/repo/apps/backend/.venv/bin/pyrefly'
    })
    expect(definition).toHaveBeenLastCalledWith({
      filePath: '/repo/apps/backend/c.py',
      text: 'import b',
      line: 0,
      character: 7
    })
  })

  it('refuses anything but a Python file at an absolute path', async () => {
    const { service, startSession } = setup()

    const relative = await service.definition({ ...request, filePath: 'apps/a.py' })
    const notPython = await service.definition({ ...request, filePath: '/repo/a.ts' })
    expect(relative.ok).toBe(false)
    expect(notPython.ok).toBe(false)
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
