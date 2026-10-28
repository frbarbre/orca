import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as GithubApiRepositoryModule from './github-api-repository'
import type * as GitHubEnterpriseRepositoryModule from './github-enterprise-repository'

const { clientMocks, moduleMocks } = await vi.hoisted(async () => {
  const moduleMocks = await import('./client-test-mocks')
  return { clientMocks: moduleMocks.createGitHubClientMocks(), moduleMocks }
})

vi.mock('./gh-utils', () => moduleMocks.ghUtilsModuleMock(clientMocks))
vi.mock('../git/runner', () => moduleMocks.gitRunnerModuleMock(clientMocks))
vi.mock('./local-git-config-signature', () =>
  moduleMocks.localGitConfigSignatureModuleMock(clientMocks)
)
vi.mock('./github-enterprise-repository', async (importOriginal) =>
  moduleMocks.githubEnterpriseRepositoryModuleMock(
    await importOriginal<typeof GitHubEnterpriseRepositoryModule>()
  )
)
vi.mock('./rate-limit', () => moduleMocks.rateLimitModuleMock(clientMocks))
vi.mock('./github-api-repository', async (importOriginal) =>
  moduleMocks.githubApiRepositoryModuleMock(
    clientMocks,
    await importOriginal<typeof GithubApiRepositoryModule>()
  )
)

import { getPRComments } from './client/fetch/get-pr-comments'
import { resetGraphQLRateLimitGuardMocks } from './client-test-harness'
import type { RateLimitGuardResult } from './client-test-mocks'

const { ghExecFileAsyncMock, getOwnerRepoMock, rateLimitGuardMock } = clientMocks

function graphQLReview(databaseId: number, state: string) {
  return {
    id: `PRR_${databaseId}`,
    databaseId,
    state,
    author: { __typename: 'User', login: 'madsenmm', avatarUrl: 'https://avatar' },
    body: `review ${databaseId}`,
    createdAt: '2026-10-13T08:00:00Z',
    url: `https://github.com/acme/widgets/pull/7#pullrequestreview-${databaseId}`,
    reactionGroups: []
  }
}

describe('review summary state', () => {
  beforeEach(() => {
    resetGraphQLRateLimitGuardMocks(clientMocks)
  })

  afterEach(() => vi.restoreAllMocks())

  it('keeps whether a GraphQL review approved, requested changes or commented', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'acme', repo: 'widgets' })
    ghExecFileAsyncMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { nodes: [] },
                comments: { nodes: [] },
                reviews: {
                  nodes: [
                    graphQLReview(1, 'APPROVED'),
                    graphQLReview(2, 'CHANGES_REQUESTED'),
                    graphQLReview(3, 'COMMENTED')
                  ]
                }
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: '[]' })

    const comments = await getPRComments('/repo-root', 7)

    expect(Object.fromEntries(comments.map((c) => [c.id, c.reviewState]))).toEqual({
      1: 'approved',
      2: 'changes-requested',
      3: 'commented'
    })
    expect(ghExecFileAsyncMock.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.stringMatching(/reviews\(first: 100\)[\s\S]*\bstate\b/)])
    )
  })

  it('keeps whether this viewer may edit a review summary', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'acme', repo: 'widgets' })
    ghExecFileAsyncMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { nodes: [] },
                comments: { nodes: [] },
                reviews: {
                  nodes: [
                    { ...graphQLReview(1, 'COMMENTED'), viewerCanUpdate: true },
                    { ...graphQLReview(2, 'APPROVED'), viewerCanUpdate: false }
                  ]
                }
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: '[]' })

    const comments = await getPRComments('/repo-root', 7)

    expect(Object.fromEntries(comments.map((c) => [c.id, c.viewerCanUpdate]))).toEqual({
      1: true,
      2: false
    })
  })

  it('keeps whether this viewer may delete an inline review comment', async () => {
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'acme', repo: 'widgets' })
    const reviewComment = (databaseId: number, viewerCanDelete: boolean) => ({
      id: `PRRC_${databaseId}`,
      databaseId,
      author: { __typename: 'User', login: 'frbarbre', avatarUrl: 'https://avatar' },
      body: `comment ${databaseId}`,
      createdAt: '2026-10-13T08:00:00Z',
      lastEditedAt: null,
      viewerCanUpdate: true,
      viewerCanDelete,
      url: `https://github.com/acme/widgets/pull/7#discussion_r${databaseId}`,
      path: 'src/a.ts',
      reactionGroups: []
    })
    ghExecFileAsyncMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  nodes: [
                    {
                      id: 'PRRT_1',
                      isResolved: false,
                      line: 3,
                      startLine: null,
                      originalLine: 3,
                      originalStartLine: null,
                      comments: { nodes: [reviewComment(11, true), reviewComment(12, false)] }
                    }
                  ]
                },
                comments: { nodes: [] },
                reviews: { nodes: [] }
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({ stdout: '[]' })
      .mockResolvedValueOnce({ stdout: '[]' })

    const comments = await getPRComments('/repo-root', 7)

    expect(Object.fromEntries(comments.map((c) => [c.id, c.viewerCanDelete]))).toEqual({
      11: true,
      12: false
    })
    expect(ghExecFileAsyncMock.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.stringMatching(/reviewThreads[\s\S]*\bviewerCanDelete\b/)])
    )
  })

  it('keeps the state from REST reviews when GraphQL is rate limited', async () => {
    rateLimitGuardMock.mockImplementation(((bucket: string) =>
      bucket === 'graphql'
        ? { blocked: true, remaining: 4, limit: 5000, resetAt: 1_800_000_000 }
        : { blocked: false }) as () => RateLimitGuardResult)
    getOwnerRepoMock.mockResolvedValueOnce({ owner: 'acme', repo: 'widgets' })
    ghExecFileAsyncMock.mockResolvedValueOnce({ stdout: '[]' }).mockResolvedValueOnce({
      stdout: JSON.stringify([
        {
          id: 9,
          user: { login: 'madsenmm', avatar_url: 'https://avatar', type: 'User' },
          body: 'Please rebase with main',
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-10-13T08:00:00Z',
          html_url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-9'
        }
      ])
    })

    const comments = await getPRComments('/repo-root', 7)

    expect(comments).toEqual([expect.objectContaining({ id: 9, reviewState: 'changes-requested' })])
  })
})
