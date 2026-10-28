import { describe, expect, it } from 'vitest'
import { resolveLinterLaunch } from './linter-launch'

function fileSystem(paths: string[]): (path: string) => boolean {
  const known = new Set(paths)
  return (path) => known.has(path)
}

const request = {
  linter: 'oxlint' as const,
  command: null,
  filePath: '/wt/apps/frontend/src/a.tsx',
  worktreeRoot: '/wt',
  repoRoot: null
}

describe('resolveLinterLaunch', () => {
  it('runs the project-installed oxlint from the folder holding the nearest config', () => {
    const exists = fileSystem([
      '/wt/apps/frontend/.oxlintrc.json',
      '/wt/apps/frontend/node_modules/.bin/oxlint'
    ])

    expect(resolveLinterLaunch(request, exists)).toEqual({
      linter: 'oxlint',
      serverName: 'oxlint',
      projectRoot: '/wt/apps/frontend',
      program: '/wt/apps/frontend/node_modules/.bin/oxlint',
      args: ['--lsp'],
      env: {},
      pathPrefix: []
    })
  })

  it('finds a TypeScript config and an oxlint installed further up', () => {
    const exists = fileSystem(['/wt/oxlint.config.ts', '/wt/node_modules/.bin/oxlint'])

    expect(resolveLinterLaunch(request, exists)).toMatchObject({
      projectRoot: '/wt',
      program: '/wt/node_modules/.bin/oxlint'
    })
  })

  it("borrows the main checkout's oxlint for a worktree without node_modules", () => {
    const exists = fileSystem([
      '/wt/apps/frontend/.oxlintrc.json',
      '/repo/apps/frontend/node_modules/.bin/oxlint'
    ])

    expect(resolveLinterLaunch({ ...request, repoRoot: '/repo' }, exists)).toMatchObject({
      projectRoot: '/wt/apps/frontend',
      program: '/repo/apps/frontend/node_modules/.bin/oxlint'
    })
  })

  it('uses the path from settings', () => {
    const exists = fileSystem(['/wt/apps/frontend/.oxlintrc.json'])

    expect(resolveLinterLaunch({ ...request, command: '/opt/bin/oxlint' }, exists)).toMatchObject({
      program: '/opt/bin/oxlint'
    })
  })

  it('lints nothing in a project without an oxlint config', () => {
    const exists = fileSystem(['/wt/node_modules/.bin/oxlint'])

    expect(resolveLinterLaunch(request, exists)).toBeNull()
  })

  it('lints nothing a file type oxlint does not read', () => {
    const exists = fileSystem(['/wt/.oxlintrc.json', '/wt/node_modules/.bin/oxlint'])

    expect(resolveLinterLaunch({ ...request, filePath: '/wt/a.py' }, exists)).toBeNull()
  })
})
