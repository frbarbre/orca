import { describe, expect, it, vi } from 'vitest'
import { createGitBlameService } from './git-blame-service'

const SHA = '3f2a9c1e5b7d4a6c8e0f1a2b3c4d5e6f7a8b9c0d'
const UNCOMMITTED = '0000000000000000000000000000000000000000'

function porcelain(sha: string, summary: string, author = 'Frederik Barbre'): string {
  return [
    `${sha} 12 12 1`,
    `author ${author}`,
    'author-mail <fba@flowbase.io>',
    'author-time 1760000000',
    'author-tz +0200',
    'committer GitHub',
    'committer-mail <noreply@github.com>',
    'committer-time 1760000100',
    'committer-tz +0000',
    `summary ${summary}`,
    'filename apps/frontend/src/a.ts',
    '\tconst a = 1',
    ''
  ].join('\n')
}

const request = {
  worktreeRoot: '/repo',
  filePath: '/repo/apps/frontend/src/a.ts',
  line: 12,
  text: 'const a = 1\n'
}

function setup(blameOutput = porcelain(SHA, 'feat: paste between pages (#3339)')) {
  const runGit = vi.fn(async (args: string[], _options: { cwd: string; stdin?: string }) =>
    args[0] === 'config' ? 'FBA@flowbase.io\n' : blameOutput
  )
  const fetchCommitPulls = vi.fn(async (): Promise<unknown> => [])
  const service = createGitBlameService({
    runGit,
    ownerRepoFor: async () => ({ owner: 'flowbase', repo: 'flowbase' }),
    fetchCommitPulls
  })
  return { service, runGit, fetchCommitPulls }
}

describe('git blame service', () => {
  it("blames the editor's current text, so unsaved edits count", async () => {
    const { service, runGit } = setup()

    await service.blameLine(request)
    expect(runGit).toHaveBeenCalledWith(
      ['blame', '--porcelain', '-L', '12,12', '--contents', '-', '--', 'apps/frontend/src/a.ts'],
      { cwd: '/repo', stdin: 'const a = 1\n' }
    )
  })

  it("reads the line's commit and marks it as mine when my git email wrote it", async () => {
    const { service } = setup()

    await expect(service.blameLine(request)).resolves.toEqual({
      ok: true,
      blame: {
        uncommitted: false,
        commit: {
          sha: SHA,
          summary: 'feat: paste between pages (#3339)',
          authorName: 'Frederik Barbre',
          authorEmail: 'fba@flowbase.io',
          authorTime: 1760000000,
          committerName: 'GitHub',
          isCurrentUser: true
        }
      }
    })
  })

  it('reports a line that is not committed yet', async () => {
    const { service } = setup(porcelain(UNCOMMITTED, 'Version of a.ts from a.ts', 'External file'))

    await expect(service.blameLine(request)).resolves.toEqual({
      ok: true,
      blame: { uncommitted: true }
    })
  })

  it('refuses a file outside the worktree', async () => {
    const { service, runGit } = setup()

    const result = await service.blameLine({ ...request, filePath: '/elsewhere/a.ts' })
    expect(result.ok).toBe(false)
    expect(runGit).not.toHaveBeenCalled()
  })

  it("links the commit and takes a squash-merged PR from the summary's (#N)", async () => {
    const { service, fetchCommitPulls } = setup()

    await expect(
      service.links({
        worktreeRoot: '/repo',
        sha: SHA,
        summary: 'feat: paste between pages (#3339)'
      })
    ).resolves.toEqual({
      commitUrl: `https://github.com/flowbase/flowbase/commit/${SHA}`,
      pullRequest: {
        number: 3339,
        title: 'feat: paste between pages',
        url: 'https://github.com/flowbase/flowbase/pull/3339'
      }
    })
    expect(fetchCommitPulls).not.toHaveBeenCalled()
  })

  it('asks GitHub for the PR of any other commit, once, preferring the merged one', async () => {
    const { service, fetchCommitPulls } = setup()
    fetchCommitPulls.mockResolvedValue([
      { number: 10, title: 'Draft', html_url: 'https://github.com/x/pull/10', merged_at: null },
      { number: 12, title: 'Shipped', html_url: 'https://github.com/x/pull/12', merged_at: 'now' }
    ])
    const commit = { worktreeRoot: '/repo', sha: SHA, summary: 'Merge branch main' }

    await service.links(commit)
    const links = await service.links(commit)
    expect(links.pullRequest).toEqual({
      number: 12,
      title: 'Shipped',
      url: 'https://github.com/x/pull/12'
    })
    expect(fetchCommitPulls).toHaveBeenCalledTimes(1)
  })

  it('has no links for a repo that is not on GitHub', async () => {
    const service = createGitBlameService({
      runGit: async () => '',
      ownerRepoFor: async () => null,
      fetchCommitPulls: async () => []
    })

    await expect(
      service.links({ worktreeRoot: '/repo', sha: SHA, summary: 'x (#1)' })
    ).resolves.toEqual({ commitUrl: null, pullRequest: null })
  })
})
