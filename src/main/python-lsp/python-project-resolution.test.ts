import { describe, expect, it } from 'vitest'
import { resolvePythonProject } from './python-project-resolution'

const worktree = '/repo'

function existsIn(paths: string[]) {
  const set = new Set(paths)
  return (path: string) => set.has(path)
}

describe('resolvePythonProject', () => {
  it('runs the nearest project with its own .venv pyrefly', () => {
    const exists = existsIn([
      '/repo/apps/backend/pyrefly.toml',
      '/repo/apps/backend/.venv/bin/pyrefly',
      '/repo/pyproject.toml'
    ])
    expect(
      resolvePythonProject({
        filePath: '/repo/apps/backend/djank/models.py',
        worktreeRoot: worktree,
        venvSetting: null,
        exists
      })
    ).toEqual({
      projectRoot: '/repo/apps/backend',
      venvPath: '/repo/apps/backend/.venv',
      pyrefly: '/repo/apps/backend/.venv/bin/pyrefly'
    })
  })

  it('uses the configured venv, relative to the worktree, over a found one', () => {
    const exists = existsIn([
      '/repo/apps/backend/pyproject.toml',
      '/repo/apps/backend/.venv/bin/pyrefly',
      '/repo/envs/py312/bin/pyrefly'
    ])
    expect(
      resolvePythonProject({
        filePath: '/repo/apps/backend/a.py',
        worktreeRoot: worktree,
        venvSetting: 'envs/py312',
        exists
      })
    ).toEqual({
      projectRoot: '/repo/apps/backend',
      venvPath: '/repo/envs/py312',
      pyrefly: '/repo/envs/py312/bin/pyrefly'
    })
  })

  it('accepts an absolute venv and falls back to pyrefly on PATH when the venv has none', () => {
    const exists = existsIn(['/repo/pyproject.toml', '/opt/venvs/app/bin/python'])
    expect(
      resolvePythonProject({
        filePath: '/repo/pkg/a.py',
        worktreeRoot: worktree,
        venvSetting: '/opt/venvs/app',
        exists
      })
    ).toEqual({ projectRoot: '/repo', venvPath: '/opt/venvs/app', pyrefly: 'pyrefly' })
  })

  it("borrows the main checkout's venv when the worktree has none of its own", () => {
    const exists = existsIn([
      '/wt/e-5139/apps/backend/pyproject.toml',
      '/repo/apps/backend/.venv/bin/pyrefly'
    ])
    expect(
      resolvePythonProject({
        filePath: '/wt/e-5139/apps/backend/djank/models.py',
        worktreeRoot: '/wt/e-5139',
        repoRoot: '/repo',
        venvSetting: null,
        exists
      })
    ).toEqual({
      projectRoot: '/wt/e-5139/apps/backend',
      venvPath: '/repo/apps/backend/.venv',
      pyrefly: '/repo/apps/backend/.venv/bin/pyrefly'
    })
  })

  it('resolves a relative venv setting against the main checkout when the worktree lacks it', () => {
    const exists = existsIn([
      '/wt/e-5139/apps/backend/pyproject.toml',
      '/repo/apps/backend/.venv/bin/pyrefly'
    ])
    expect(
      resolvePythonProject({
        filePath: '/wt/e-5139/apps/backend/a.py',
        worktreeRoot: '/wt/e-5139',
        repoRoot: '/repo',
        venvSetting: 'apps/backend/.venv',
        exists
      }).pyrefly
    ).toBe('/repo/apps/backend/.venv/bin/pyrefly')
  })

  it('treats the worktree as the project when no config file is found', () => {
    expect(
      resolvePythonProject({
        filePath: '/repo/scripts/run.py',
        worktreeRoot: worktree,
        venvSetting: null,
        exists: existsIn([])
      })
    ).toEqual({ projectRoot: '/repo', venvPath: null, pyrefly: 'pyrefly' })
  })
})
