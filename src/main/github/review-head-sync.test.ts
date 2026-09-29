import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { syncReviewHead } from './review-head-sync'

let gitConfigRoot: string
let previousGlobal: string | undefined
let previousNosystem: string | undefined

beforeAll(() => {
  gitConfigRoot = mkdtempSync(join(tmpdir(), 'orca-review-head-gitconfig-'))
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

let root: string
let author: string
let review: string

function run(cwd: string, email: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: email,
      GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: email,
      GIT_COMMITTER_EMAIL: email
    }
  }).trim()
}

const AUTHOR = 'author@example.com'
const ME = 'me@example.com'

function commit(cwd: string, email: string, name: string, content: string): string {
  writeFileSync(join(cwd, name), content)
  run(cwd, email, 'add', name)
  run(cwd, email, 'commit', '-q', '-m', `${name} ${content.trim()}`)
  return run(cwd, email, 'rev-parse', 'HEAD')
}

function forcePushRebased(): string {
  run(author, AUTHOR, 'reset', '-q', '--hard', 'main')
  const head = commit(author, AUTHOR, 'feature.ts', 'rebased\n')
  run(author, AUTHOR, 'push', '-q', '--force', 'origin', 'feature')
  return head
}

describe('syncReviewHead', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-review-head-'))
    const origin = join(root, 'origin.git')
    author = join(root, 'author')
    review = join(root, 'review')
    run(root, AUTHOR, 'init', '-q', '--bare', '-b', 'main', origin)
    run(root, AUTHOR, 'clone', '-q', origin, author)
    commit(author, AUTHOR, 'app.ts', 'base\n')
    run(author, AUTHOR, 'push', '-q', 'origin', 'main')
    run(author, AUTHOR, 'switch', '-q', '-c', 'feature')
    commit(author, AUTHOR, 'stacked.ts', 'parent work\n')
    commit(author, AUTHOR, 'feature.ts', 'first\n')
    run(author, AUTHOR, 'push', '-q', '-u', 'origin', 'feature')
    run(root, ME, 'clone', '-q', '--branch', 'feature', origin, review)
    run(review, ME, 'config', 'user.email', ME)
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('moves a review checkout onto the head the author force-pushed', async () => {
    const before = run(review, ME, 'rev-parse', 'HEAD')
    const head = forcePushRebased()

    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: head })
    ).toEqual({
      kind: 'updated',
      previousHead: before
    })
    expect(run(review, ME, 'rev-parse', 'HEAD')).toBe(head)
  })

  it('reports a checkout already on the head', async () => {
    const head = run(review, ME, 'rev-parse', 'HEAD')
    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: head })
    ).toEqual({
      kind: 'current'
    })
  })

  it('keeps a checkout holding a commit of the reviewer', async () => {
    const mine = commit(review, ME, 'notes.md', 'my fix\n')
    const head = forcePushRebased()

    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: head })
    ).toEqual({
      kind: 'skipped',
      reason: 'own-commits'
    })
    expect(run(review, ME, 'rev-parse', 'HEAD')).toBe(mine)
  })

  it('keeps a checkout with uncommitted changes', async () => {
    writeFileSync(join(review, 'app.ts'), 'edited\n')
    const head = forcePushRebased()

    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: head })
    ).toEqual({
      kind: 'skipped',
      reason: 'dirty'
    })
  })

  it('keeps a checkout that is not on the pull request branch', async () => {
    run(review, ME, 'switch', '-q', '--detach')
    const head = forcePushRebased()

    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: head })
    ).toEqual({
      kind: 'skipped',
      reason: 'other-branch'
    })
  })

  it('keeps a checkout when the head cannot be fetched', async () => {
    expect(
      await syncReviewHead({ worktreePath: review, branch: 'feature', headOid: 'f'.repeat(40) })
    ).toEqual({ kind: 'skipped', reason: 'unreachable' })
  })
})
