import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ghExecFileAsync: vi.fn() }))

vi.mock('./gh-utils', () => ({
  acquire: vi.fn(async () => undefined),
  release: vi.fn(),
  ghExecFileAsync: mocks.ghExecFileAsync
}))
vi.mock('./github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'acme', repo: 'app' },
    ghOptions: {}
  }))
}))

import { getPullRequestReviewContext } from './submit-review-verdict'

describe('getPullRequestReviewContext', () => {
  beforeEach(() => mocks.ghExecFileAsync.mockReset())

  it('names a requested team by org and slug, the form a removal takes, and reports the author', async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              id: 'PR_1',
              author: { login: 'frbarbre' },
              reviewRequests: {
                nodes: [
                  {
                    requestedReviewer: {
                      __typename: 'Team',
                      slug: 'frontend',
                      combinedSlug: 'acme/frontend',
                      name: 'Frontend'
                    }
                  }
                ]
              }
            }
          }
        }
      })
    })

    const context = await getPullRequestReviewContext({ repoPath: '/repo', prNumber: 1 })

    expect(mocks.ghExecFileAsync.mock.calls[0]?.[0].join(' ')).toContain('combinedSlug')
    expect(context.authorLogin).toBe('frbarbre')
    expect(context.reviewers).toMatchObject([
      { kind: 'team', login: 'acme/frontend', name: 'Frontend', canRemove: true }
    ])
  })
})
