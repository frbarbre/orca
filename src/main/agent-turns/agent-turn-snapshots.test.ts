import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listAgentTurns, recordAgentTurn, snapshotWorktree } from './agent-turn-snapshots'

const tempRoots: string[] = []

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

async function createRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-agent-turns-'))
  tempRoots.push(root)
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 'dev@example.com')
  git(root, 'config', 'user.name', 'Dev')
  await writeFile(path.join(root, 'a.txt'), 'one\n')
  await writeFile(path.join(root, 'b.txt'), 'two\n')
  await writeFile(path.join(root, '.gitignore'), 'ignored.log\n')
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', 'init')
  return root
}

function turnInput(repo: string, startOid: string, prompt = 'make it so') {
  return {
    worktreePath: repo,
    startOid,
    prompt,
    agent: 'claude',
    paneKey: 'tab:leaf',
    startedAt: 1000,
    completedAt: 2000
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('agent turn snapshots', () => {
  it('records exactly what changed during the turn, whatever was already uncommitted', async () => {
    const repo = await createRepo()
    await writeFile(path.join(repo, 'a.txt'), 'one\nstaged before\n')
    git(repo, 'add', 'a.txt')
    await writeFile(path.join(repo, 'b.txt'), 'two\nunstaged before\n')

    const startOid = await snapshotWorktree(repo)
    await writeFile(path.join(repo, 'b.txt'), 'two\nunstaged before\nby the agent\n')
    await writeFile(path.join(repo, 'new.txt'), 'brand new\n')
    await writeFile(path.join(repo, 'ignored.log'), 'noise\n')
    const turn = await recordAgentTurn(turnInput(repo, startOid))

    expect(turn).not.toBeNull()
    expect(git(repo, 'diff', '--name-only', turn!.parentOid, turn!.oid).split('\n')).toEqual([
      'b.txt',
      'new.txt'
    ])
    expect(turn).toMatchObject({ prompt: 'make it so', agent: 'claude', files: 2, insertions: 2 })
  })

  it('leaves the real index and working tree untouched', async () => {
    const repo = await createRepo()
    await writeFile(path.join(repo, 'a.txt'), 'one\nstaged\n')
    git(repo, 'add', 'a.txt')
    await writeFile(path.join(repo, 'loose.txt'), 'untracked\n')
    const statusBefore = git(repo, 'status', '--porcelain')

    const startOid = await snapshotWorktree(repo)
    await recordAgentTurn(turnInput(repo, startOid))

    expect(git(repo, 'status', '--porcelain')).toBe(statusBefore)
    expect(git(repo, 'diff', '--cached', '--name-only')).toBe('a.txt')
  })

  it('skips a turn that changed nothing', async () => {
    const repo = await createRepo()
    const startOid = await snapshotWorktree(repo)
    expect(await recordAgentTurn(turnInput(repo, startOid))).toBeNull()
    expect(await listAgentTurns(repo)).toEqual([])
  })

  it('lists turns newest first and keeps only the most recent ones', async () => {
    const repo = await createRepo()
    for (const n of [1, 2, 3]) {
      const startOid = await snapshotWorktree(repo)
      await writeFile(path.join(repo, 'a.txt'), `turn ${n}\n`)
      await recordAgentTurn({ ...turnInput(repo, startOid, `turn ${n}`), completedAt: n, keep: 2 })
    }
    expect((await listAgentTurns(repo)).map((turn) => turn.prompt)).toEqual(['turn 3', 'turn 2'])
  })

  it('works without a first commit', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'orca-agent-turns-empty-'))
    tempRoots.push(root)
    git(root, 'init', '-q')
    const startOid = await snapshotWorktree(root)
    await writeFile(path.join(root, 'x.txt'), 'x\n')
    expect(await recordAgentTurn(turnInput(root, startOid))).toMatchObject({ files: 1 })
  })
})
