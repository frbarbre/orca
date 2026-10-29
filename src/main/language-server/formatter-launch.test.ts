import { describe, expect, it } from 'vitest'
import { resolveFormatterLaunch } from './formatter-launch'

function fileSystem(files: Record<string, string>) {
  return {
    exists: (path: string) => Object.hasOwn(files, path),
    read: (path: string) => (Object.hasOwn(files, path) ? files[path] : null)
  }
}

const oxfmt = {
  formatter: 'oxfmt' as const,
  command: null,
  filePath: '/wt/apps/frontend/src/a.tsx',
  worktreeRoot: '/wt',
  repoRoot: null,
  venvSetting: null
}

const ruff = {
  ...oxfmt,
  formatter: 'ruff' as const,
  filePath: '/wt/apps/backend/djank/a.py'
}

describe('resolveFormatterLaunch', () => {
  it('runs the project-installed oxfmt from the folder holding the nearest config', () => {
    const files = fileSystem({
      '/wt/apps/frontend/.oxfmtrc.json': '{}',
      '/wt/apps/frontend/node_modules/.bin/oxfmt': ''
    })

    expect(resolveFormatterLaunch(oxfmt, files)).toEqual({
      formatter: 'oxfmt',
      serverName: 'oxfmt',
      projectRoot: '/wt/apps/frontend',
      program: '/wt/apps/frontend/node_modules/.bin/oxfmt',
      args: ['--lsp'],
      env: {},
      pathPrefix: []
    })
  })

  it("borrows the main checkout's oxfmt for a worktree without node_modules", () => {
    const files = fileSystem({
      '/wt/apps/frontend/.oxfmtrc.json': '{}',
      '/repo/apps/frontend/node_modules/.bin/oxfmt': ''
    })

    expect(resolveFormatterLaunch({ ...oxfmt, repoRoot: '/repo' }, files)).toMatchObject({
      program: '/repo/apps/frontend/node_modules/.bin/oxfmt'
    })
  })

  it("runs ruff from the venv pyrefly would use, beside the project's ruff config", () => {
    const files = fileSystem({
      '/wt/apps/backend/.ruff.toml': '',
      '/wt/apps/backend/pyproject.toml': '[project]',
      '/wt/apps/backend/.venv/bin/python': '',
      '/wt/apps/backend/.venv/bin/ruff': ''
    })

    expect(resolveFormatterLaunch(ruff, files)).toEqual({
      formatter: 'ruff',
      serverName: 'Ruff',
      projectRoot: '/wt/apps/backend',
      program: '/wt/apps/backend/.venv/bin/ruff',
      args: ['server'],
      env: {},
      pathPrefix: []
    })
  })

  it("borrows the main checkout's venv for a worktree without one", () => {
    const files = fileSystem({
      '/wt/.ruff.toml': '',
      '/repo/.venv/bin/python': '',
      '/repo/.venv/bin/ruff': ''
    })

    expect(resolveFormatterLaunch({ ...ruff, repoRoot: '/repo' }, files)).toMatchObject({
      projectRoot: '/wt',
      program: '/repo/.venv/bin/ruff'
    })
  })

  it('follows the venv set in settings', () => {
    const files = fileSystem({
      '/wt/ruff.toml': '',
      '/wt/envs/py/bin/python': '',
      '/wt/envs/py/bin/ruff': ''
    })

    expect(resolveFormatterLaunch({ ...ruff, venvSetting: 'envs/py' }, files)).toMatchObject({
      program: '/wt/envs/py/bin/ruff'
    })
  })

  it('counts a pyproject.toml only when it configures ruff', () => {
    const configured = fileSystem({ '/wt/pyproject.toml': '[tool.ruff]\nline-length = 88' })
    const unrelated = fileSystem({ '/wt/pyproject.toml': '[tool.black]\nline-length = 88' })

    expect(resolveFormatterLaunch(ruff, configured)).toMatchObject({
      projectRoot: '/wt',
      program: 'ruff'
    })
    expect(resolveFormatterLaunch(ruff, unrelated)).toBeNull()
  })

  it('uses the path from settings', () => {
    const files = fileSystem({ '/wt/.ruff.toml': '', '/wt/.venv/bin/ruff': '' })

    expect(
      resolveFormatterLaunch({ ...ruff, command: '~/bin/ruff' }, files, '/home/me')
    ).toMatchObject({ program: '/home/me/bin/ruff' })
  })

  it('formats nothing in a project without a config, or a file type it does not handle', () => {
    const files = fileSystem({ '/wt/node_modules/.bin/oxfmt': '', '/wt/.ruff.toml': '' })

    expect(resolveFormatterLaunch(oxfmt, files)).toBeNull()
    expect(resolveFormatterLaunch({ ...ruff, filePath: '/wt/a.ts' }, files)).toBeNull()
  })
})
