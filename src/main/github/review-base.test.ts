import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getBranchCompare } from '../git/source-control/branch-compare'
import { resolveReviewBase } from './review-base'

// Why an empty global config: the code under test runs git through the production runner, which
// inherits process.env, so a developer's own git config must not leak into the fixture.
let gitConfigRoot: string
let previousGlobal: string | undefined
let previousNosystem: string | undefined

beforeAll(() => {
  gitConfigRoot = mkdtempSync(join(tmpdir(), 'orca-review-base-gitconfig-'))
  const emptyGlobal = join(gitConfigRoot, 'global.gitconfig')
  writeFileSync(emptyGlobal, '')
  previousGlobal = process.env.GIT_CONFIG_GLOBAL
  previousNosystem = process.env.GIT_CONFIG_NOSYSTEM
  process.env.GIT_CONFIG_GLOBAL = emptyGlobal
  process.env.GIT_CONFIG_NOSYSTEM = '1'
})

afterAll(() => {
  process.env.GIT_CONFIG_GLOBAL = previousGlobal
  process.env.GIT_CONFIG_NOSYSTEM = previousNosystem
  rmSync(gitConfigRoot, { recursive: true, force: true })
})

let repo: string

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com'
    }
  }).trim()
}

function commitFile(name: string, content: string, message: string): string {
  writeFileSync(join(repo, name), content)
  git('add', name)
  git('commit', '-q', '-m', message)
  return git('rev-parse', 'HEAD')
}

describe('resolveReviewBase', () => {
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'orca-review-base-'))
    git('init', '-q', '-b', 'main')
    commitFile('app.ts', 'export const a = 1\n', 'base')
  })

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('keeps the reviewed commit while it is still in the branch', async () => {
    git('switch', '-q', '-c', 'feature')
    const reviewed = commitFile('feature.ts', 'export const f = 1\n', 'feature')
    commitFile('feature.ts', 'export const f = 2\n', 'address review')

    expect(
      await resolveReviewBase({ worktreePath: repo, reviewedCommit: reviewed, targetRef: 'main' })
    ).toEqual({ kind: 'reviewed', baseRef: reviewed })
  })

  it('compares a rebased branch against the reviewed version replayed onto its new base', async () => {
    git('switch', '-q', '-c', 'feature')
    const reviewed = commitFile('feature.ts', 'export const f = 1\n', 'feature')
    git('switch', '-q', 'main')
    commitFile('backend.py', 'x = 1\n', 'unrelated main work')
    git('switch', '-q', 'feature')
    git('rebase', '-q', 'main')
    commitFile('feature.ts', 'export const f = 2\n', 'address review')

    const result = await resolveReviewBase({
      worktreePath: repo,
      reviewedCommit: reviewed,
      targetRef: 'main'
    })

    expect(result).toMatchObject({ kind: 'interdiff', conflicted: false })
    const baseRef = result.kind === 'interdiff' ? result.baseRef : ''
    expect(baseRef).toMatch(/^refs\/orca\/review-base\//)
    // Only the change made since the review; main's new file and the replayed feature cancel out.
    expect(git('diff', '--name-only', baseRef, 'HEAD')).toBe('feature.ts')

    const compare = await getBranchCompare(repo, baseRef)
    expect(compare.summary.mergeBase).toBe(compare.summary.baseOid)
    expect(compare.entries.map((entry) => entry.path)).toEqual(['feature.ts'])
  })

  it('replaces the previous interdiff base when it is rebuilt', async () => {
    git('switch', '-q', '-c', 'feature')
    const reviewed = commitFile('feature.ts', 'export const f = 1\n', 'feature')
    git('switch', '-q', 'main')
    commitFile('backend.py', 'x = 1\n', 'unrelated main work')
    git('switch', '-q', 'feature')
    git('rebase', '-q', 'main')
    const request = { worktreePath: repo, reviewedCommit: reviewed, targetRef: 'main' }
    const first = await resolveReviewBase(request)
    git('switch', '-q', 'main')
    commitFile('backend.py', 'x = 2\n', 'more main work')
    git('switch', '-q', 'feature')
    git('rebase', '-q', 'main')

    const second = await resolveReviewBase(request)

    expect(second.kind === 'interdiff' && second.baseRef).not.toBe(
      first.kind === 'interdiff' && first.baseRef
    )
    expect(
      git('for-each-ref', '--format=%(refname)', 'refs/orca/review-base/').split('\n')
    ).toEqual([second.kind === 'interdiff' ? second.baseRef : ''])
  })

  it('reports a reviewed commit this repository does not have', async () => {
    expect(
      await resolveReviewBase({
        worktreePath: repo,
        reviewedCommit: '1111111111111111111111111111111111111111',
        targetRef: 'main'
      })
    ).toEqual({ kind: 'missing' })
  })
})
