import { describe, expect, it } from 'vitest'
import { githubFileMentionMarkdown, githubFileMentionTarget } from './github-file-mention'

describe('githubFileMentionMarkdown', () => {
  it("links the file on the pull request's branch", () => {
    expect(
      githubFileMentionMarkdown('apps/frontend/a b.ts', {
        owner: 'acme',
        repo: 'app',
        ref: 'feature/x'
      })
    ).toBe(
      '[`apps/frontend/a b.ts`](https://github.com/acme/app/blob/feature/x/apps/frontend/a%20b.ts)'
    )
  })

  it('links on the GitHub Enterprise host the repository lives on', () => {
    expect(
      githubFileMentionMarkdown('README.md', {
        host: 'git.corp.example',
        owner: 'acme',
        repo: 'app',
        ref: 'main'
      })
    ).toBe('[`README.md`](https://git.corp.example/acme/app/blob/main/README.md)')
  })

  it('names the file as code when there is no branch on GitHub to link to', () => {
    expect(githubFileMentionMarkdown('README.md', null)).toBe('`README.md`')
  })
})

describe('githubFileMentionTarget', () => {
  it("prefers the pull request's head repository and branch, for a fork's pull request", () => {
    expect(
      githubFileMentionTarget(
        {
          headRefName: 'fix',
          prRepo: { owner: 'acme', repo: 'app' },
          headRepo: { owner: 'me', repo: 'app-fork' }
        },
        'local-branch'
      )
    ).toEqual({ owner: 'me', repo: 'app-fork', ref: 'fix' })
  })

  it("falls back to the workspace branch, and to nothing without the PR's repository", () => {
    expect(
      githubFileMentionTarget({ prRepo: { owner: 'acme', repo: 'app' } }, 'local-branch')
    ).toEqual({ owner: 'acme', repo: 'app', ref: 'local-branch' })
    expect(githubFileMentionTarget(null, 'local-branch')).toBeNull()
  })
})
