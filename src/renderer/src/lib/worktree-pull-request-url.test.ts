import { describe, expect, it } from 'vitest'
import { worktreeCardReviewCacheKeys } from '@/components/sidebar/worktree-card-review-resolution'
import {
  activeWorktreeGitHubPullRequest,
  activeWorktreePullRequestUrl
} from './worktree-pull-request-url'

const repo = { id: 'repo-1', path: '/code/app', displayName: 'app', badgeColor: '', addedAt: 0 }
const worktree = {
  id: 'repo-1::/code/app-wt',
  repoId: 'repo-1',
  path: '/code/app-wt',
  branch: 'refs/heads/feature',
  head: 'abc'
}
const settings = {} as never

function state(overrides: Record<string, unknown> = {}) {
  return {
    activeWorktreeId: worktree.id,
    repos: [repo],
    settings,
    getKnownWorktreeById: (id: string) => (id === worktree.id ? worktree : undefined),
    hostedReviewCache: {},
    prCache: {},
    ...overrides
  } as never
}

describe('activeWorktreePullRequestUrl', () => {
  it("gives the URL of the pull request the active workspace's card shows", () => {
    const { hostedReviewCacheKey } = worktreeCardReviewCacheKeys(worktree as never, repo, settings)
    const review = {
      provider: 'github',
      number: 7,
      title: 'Feature',
      state: 'open',
      url: 'https://github.com/acme/app/pull/7',
      status: 'success',
      updatedAt: '',
      mergeable: 'MERGEABLE'
    }
    expect(
      activeWorktreePullRequestUrl(
        state({
          hostedReviewCache: {
            [hostedReviewCacheKey]: { data: review, fetchedAt: 1, branchLookupGitHubPRNumber: 7 }
          }
        })
      )
    ).toBe('https://github.com/acme/app/pull/7')
  })

  it('gives nothing without a pull request or an active workspace', () => {
    expect(activeWorktreePullRequestUrl(state())).toBeNull()
    expect(activeWorktreePullRequestUrl(state({ activeWorktreeId: null }))).toBeNull()
  })
})

describe('activeWorktreeGitHubPullRequest', () => {
  it("identifies the GitHub pull request the active workspace's card shows", () => {
    const { hostedReviewCacheKey } = worktreeCardReviewCacheKeys(worktree as never, repo, settings)
    const review = {
      provider: 'github',
      number: 7,
      title: 'Feature',
      state: 'open',
      url: 'https://github.com/acme/app/pull/7',
      status: 'success',
      updatedAt: '',
      mergeable: 'MERGEABLE',
      githubRepository: { owner: 'acme', repo: 'app' }
    }
    expect(
      activeWorktreeGitHubPullRequest(
        state({
          hostedReviewCache: {
            [hostedReviewCacheKey]: { data: review, fetchedAt: 1, branchLookupGitHubPRNumber: 7 }
          }
        })
      )
    ).toEqual({
      worktreeId: worktree.id,
      repoPath: '/code/app',
      repoId: 'repo-1',
      prNumber: 7,
      prRepo: { owner: 'acme', repo: 'app' }
    })
  })

  it('gives nothing without a pull request', () => {
    expect(activeWorktreeGitHubPullRequest(state())).toBeNull()
  })
})
