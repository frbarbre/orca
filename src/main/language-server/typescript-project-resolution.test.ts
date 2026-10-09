import { describe, expect, it } from 'vitest'
import { resolveTypeScriptProject } from './typescript-project-resolution'

function existsIn(paths: string[]) {
  const set = new Set(paths)
  return (path: string) => set.has(path)
}

describe('resolveTypeScriptProject', () => {
  it('uses the nearest tsconfig and the nearest tsgo from there up to the worktree', () => {
    const exists = existsIn([
      '/repo/tsconfig.json',
      '/repo/apps/frontend/tsconfig.json',
      '/repo/apps/frontend/node_modules/.bin/tsgo',
      '/repo/node_modules/.bin/tsgo'
    ])
    expect(
      resolveTypeScriptProject({
        filePath: '/repo/apps/frontend/src/entities/editor/a.tsx',
        worktreeRoot: '/repo',
        exists
      })
    ).toEqual({
      projectRoot: '/repo/apps/frontend',
      tsgo: '/repo/apps/frontend/node_modules/.bin/tsgo'
    })
  })

  it("falls back to the worktree's tsgo, then tsgo on PATH", () => {
    expect(
      resolveTypeScriptProject({
        filePath: '/repo/packages/lib/src/a.ts',
        worktreeRoot: '/repo',
        exists: existsIn(['/repo/packages/lib/jsconfig.json', '/repo/node_modules/.bin/tsgo'])
      })
    ).toEqual({ projectRoot: '/repo/packages/lib', tsgo: '/repo/node_modules/.bin/tsgo' })

    expect(
      resolveTypeScriptProject({
        filePath: '/repo/a.ts',
        worktreeRoot: '/repo',
        exists: existsIn([])
      })
    ).toEqual({ projectRoot: '/repo', tsgo: 'tsgo' })
  })

  it("borrows the main checkout's tsgo when the worktree has no node_modules", () => {
    expect(
      resolveTypeScriptProject({
        filePath: '/wt/e-5139/apps/frontend/src/a.ts',
        worktreeRoot: '/wt/e-5139',
        repoRoot: '/repo',
        exists: existsIn([
          '/wt/e-5139/apps/frontend/tsconfig.json',
          '/repo/apps/frontend/node_modules/.bin/tsgo'
        ])
      })
    ).toEqual({
      projectRoot: '/wt/e-5139/apps/frontend',
      tsgo: '/repo/apps/frontend/node_modules/.bin/tsgo'
    })
  })
})
