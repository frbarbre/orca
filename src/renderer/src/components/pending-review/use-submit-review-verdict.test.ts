// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  scopes: new Map<string, { repo: { id: string; path: string }; pr: { number: number } }>(),
  context: vi.fn()
}))

vi.mock('@/components/pr-comments/use-pr-comment-scope', () => ({
  usePRCommentScope: (worktreeId: string) => mocks.scopes.get(worktreeId)
}))
vi.mock('@/store', () => ({ useAppStore: () => vi.fn() }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { useSubmitReviewVerdict } from './use-submit-review-verdict'

const QUEUE = { comments: [], add: vi.fn(), updateBody: vi.fn(), remove: vi.fn(), clear: vi.fn() }

function context(login: string) {
  return {
    viewerDidAuthor: false,
    viewerLatestReviewState: null,
    viewerHasReviewRequest: false,
    viewerLatestReviewCommit: null,
    reviewers: [
      { kind: 'user', login, name: null, avatarUrl: null, state: 'pending', canRerequest: false }
    ]
  }
}

describe('useSubmitReviewVerdict', () => {
  beforeEach(() => {
    mocks.scopes.set('wt-a', { repo: { id: 'r', path: '/repo' }, pr: { number: 1 } })
    mocks.scopes.set('wt-b', { repo: { id: 'r', path: '/repo' }, pr: { number: 2 } })
    mocks.context.mockReset()
    Object.assign(window, { api: { pendingReview: { context: mocks.context } } })
  })

  it('shows no reviewers from the last pull request while the next one loads', async () => {
    let resolveB: (value: ReturnType<typeof context>) => void = () => undefined
    mocks.context
      .mockResolvedValueOnce(context('alice'))
      .mockReturnValueOnce(new Promise((resolve) => (resolveB = resolve)))

    const { result, rerender } = renderHook(
      ({ worktreeId }) => useSubmitReviewVerdict(worktreeId, QUEUE),
      { initialProps: { worktreeId: 'wt-a' } }
    )
    expect(result.current.reviewers).toBeNull()
    await act(async () => undefined)
    expect(result.current.reviewers?.map((r) => r.login)).toEqual(['alice'])

    rerender({ worktreeId: 'wt-b' })
    expect(result.current.reviewers).toBeNull()

    await act(async () => resolveB(context('bob')))
    expect(result.current.reviewers?.map((r) => r.login)).toEqual(['bob'])
  })

  it('requests and removes reviewers, then reloads who is asked', async () => {
    const requestPRReviewers = vi.fn(async () => ({ ok: true }))
    const removePRReviewers = vi.fn(async () => ({ ok: true }))
    Object.assign(window.api, { gh: { requestPRReviewers, removePRReviewers } })
    mocks.context.mockResolvedValue(context('alice'))
    const { result } = renderHook(() => useSubmitReviewVerdict('wt-a', QUEUE))
    await act(async () => undefined)
    expect(result.current.repo).toEqual({ id: 'r', path: '/repo' })

    await act(async () => {
      await result.current.requestReviewers(['bob', 'acme/frontend'])
    })
    await act(async () => {
      await result.current.removeReviewer('alice')
    })

    const target = { repoPath: '/repo', repoId: 'r', prNumber: 1, prRepo: null }
    expect(requestPRReviewers).toHaveBeenCalledWith({
      ...target,
      reviewers: ['bob', 'acme/frontend']
    })
    expect(removePRReviewers).toHaveBeenCalledWith({ ...target, reviewers: ['alice'] })
    expect(mocks.context).toHaveBeenCalledTimes(3)
  })
})
