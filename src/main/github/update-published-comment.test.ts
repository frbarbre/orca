import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ghExecFileAsync: vi.fn() }))

vi.mock('./gh-utils', () => ({
  acquire: vi.fn(async () => undefined),
  release: vi.fn(),
  ghExecFileAsync: mocks.ghExecFileAsync
}))
vi.mock('./github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'acme', repo: 'widgets' },
    ghOptions: {}
  }))
}))
vi.mock('./rate-limit', () => ({
  repositoryRateLimitGuard: () => ({ blocked: false }),
  noteRepositoryRateLimitSpend: vi.fn()
}))

import {
  deletePublishedReviewComment,
  updatePublishedReviewComment
} from './update-published-comment'

describe('updatePublishedReviewComment', () => {
  beforeEach(() => mocks.ghExecFileAsync.mockReset())

  it("rewrites a review's summary through the review mutation", async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        data: {
          updatePullRequestReview: {
            pullRequestReview: { body: 'Edited', lastEditedAt: '2026-10-15T09:00:00Z' }
          }
        }
      })
    })

    const result = await updatePublishedReviewComment({
      repoPath: '/repo',
      commentNodeId: 'PRR_1',
      body: 'Edited',
      kind: 'review'
    })

    const args: string[] = mocks.ghExecFileAsync.mock.calls[0]?.[0] ?? []
    expect(args.find((arg) => arg.startsWith('query='))).toContain('updatePullRequestReview(')
    expect(args).toContain('id=PRR_1')
    expect(result).toEqual({ ok: true, body: 'Edited', lastEditedAt: '2026-10-15T09:00:00Z' })
  })

  it('rewrites an inline review comment through the review comment mutation', async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        data: {
          updatePullRequestReviewComment: {
            pullRequestReviewComment: { body: 'Fixed', lastEditedAt: null }
          }
        }
      })
    })

    const result = await updatePublishedReviewComment({
      repoPath: '/repo',
      commentNodeId: 'PRRC_1',
      body: 'Fixed'
    })

    const args: string[] = mocks.ghExecFileAsync.mock.calls[0]?.[0] ?? []
    expect(args.find((arg) => arg.startsWith('query='))).toContain(
      'updatePullRequestReviewComment('
    )
    expect(result).toEqual({ ok: true, body: 'Fixed', lastEditedAt: null })
  })
})

describe('deletePublishedReviewComment', () => {
  beforeEach(() => mocks.ghExecFileAsync.mockReset())

  it('removes an inline review comment through the delete mutation', async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ data: { deletePullRequestReviewComment: { clientMutationId: null } } })
    })

    const result = await deletePublishedReviewComment({ repoPath: '/repo', commentNodeId: 'PRRC_1' })

    const args: string[] = mocks.ghExecFileAsync.mock.calls[0]?.[0] ?? []
    expect(args.find((arg) => arg.startsWith('query='))).toContain(
      'deletePullRequestReviewComment('
    )
    expect(args).toContain('id=PRRC_1')
    expect(result).toEqual({ ok: true })
  })

  it("passes on GitHub's reason when it refuses", async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ errors: [{ message: 'Resource not accessible by integration' }] })
    })

    const result = await deletePublishedReviewComment({ repoPath: '/repo', commentNodeId: 'PRRC_1' })

    expect(result).toEqual({ ok: false, error: 'Resource not accessible by integration' })
  })
})
