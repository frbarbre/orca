import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseShortstat, readGitDiffStat } from './git-diff-stat'

describe('parseShortstat', () => {
  it('reads files, insertions and deletions', () => {
    expect(parseShortstat(' 3 files changed, 12 insertions(+), 4 deletions(-)\n')).toEqual({
      files: 3,
      insertions: 12,
      deletions: 4
    })
    expect(parseShortstat(' 1 file changed, 1 insertion(+)\n')).toEqual({
      files: 1,
      insertions: 1,
      deletions: 0
    })
    expect(parseShortstat('')).toEqual({ files: 0, insertions: 0, deletions: 0 })
  })
})

describe('readGitDiffStat', () => {
  let repo = ''
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo })
  const commit = (...args: string[]) =>
    git('-c', 'user.email=e2e@orca', '-c', 'user.name=e2e', 'commit', '-q', ...args)

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'orca-diff-stat-'))
    git('init', '-q')
    commit('--allow-empty', '-m', 'root')
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it('counts tracked changes and untracked files with their lines', async () => {
    writeFileSync(join(repo, 'tracked.txt'), 'a\nb\n')
    git('add', 'tracked.txt')
    commit('-m', 'tracked')
    writeFileSync(join(repo, 'tracked.txt'), 'a\nc\nd\n')
    writeFileSync(join(repo, 'new.txt'), 'one\ntwo\nthree\n')

    expect(await readGitDiffStat(repo)).toEqual({ files: 2, insertions: 5, deletions: 1 })
  })

  it('reports a clean repo as no changes and a folder outside git as nothing', async () => {
    expect(await readGitDiffStat(repo)).toEqual({ files: 0, insertions: 0, deletions: 0 })
    const outside = mkdtempSync(join(tmpdir(), 'orca-no-git-'))
    try {
      expect(await readGitDiffStat(outside)).toBeNull()
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
