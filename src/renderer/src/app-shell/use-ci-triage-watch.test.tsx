// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCiTriageWatch } from './use-ci-triage-watch'

const cachedChecks = [{ name: 'lint', status: 'completed', conclusion: 'failure', url: null }]
const fetchPRChecks = vi.hoisted(() => vi.fn(async () => cachedChecks))
const maybeStartCiTriage = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/ci-triage-trigger', () => ({ maybeStartCiTriage }))
const store = vi.hoisted(() => {
  const listeners = new Set<(state: unknown, previous: unknown) => void>()
  let state: Record<string, unknown> = {}
  return {
    set(next: Record<string, unknown>) {
      const previous = state
      state = next
      for (const listener of listeners) {
        listener(state, previous)
      }
    },
    getState: () => state,
    subscribe(listener: (state: unknown, previous: unknown) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
})
vi.mock('@/store', () => ({ useAppStore: store }))
vi.mock('@/store/github/visible-hosted-review-refresh-targets', () => ({
  getVisibleHostedReviewWorkspaces: () => [
    {
      repo: { id: 'repo-1', path: '/code/app', ciTriage: {} },
      candidate: { cacheKey: 'k', branch: 'feature' }
    }
  ]
}))

const prCache = (checksStatus: string, headSha: string) => ({
  k: { data: { number: 7, state: 'open', checksStatus, headSha } }
})

afterEach(() => vi.clearAllMocks())

describe('useCiTriageWatch', () => {
  it("fetches a workspace PR's checks once each time its sidebar status turns failed", () => {
    store.set({ fetchPRChecks, prCache: prCache('pending', 'sha-a') })
    renderHook(() => useCiTriageWatch({ enabled: true }))

    store.set({ fetchPRChecks, prCache: prCache('failure', 'sha-a') })
    store.set({ fetchPRChecks, prCache: prCache('failure', 'sha-a') })
    store.set({ fetchPRChecks, prCache: prCache('failure', 'sha-b') })

    expect(fetchPRChecks).toHaveBeenCalledTimes(2)
    expect(fetchPRChecks).toHaveBeenCalledWith('/code/app', 7, 'feature', 'sha-a', null, {
      repoId: 'repo-1'
    })
  })

  it('checks what is already failed when the app starts', () => {
    store.set({ fetchPRChecks, prCache: prCache('failure', 'sha-start') })
    renderHook(() => useCiTriageWatch({ enabled: true }))

    expect(fetchPRChecks).toHaveBeenCalledWith('/code/app', 7, 'feature', 'sha-start', null, {
      repoId: 'repo-1'
    })
  })

  it('hands the checks to triage even when they came from the cache', async () => {
    store.set({ fetchPRChecks, prCache: prCache('failure', 'sha-cached') })
    renderHook(() => useCiTriageWatch({ enabled: true }))
    await vi.waitFor(() => expect(maybeStartCiTriage).toHaveBeenCalled())

    expect(maybeStartCiTriage).toHaveBeenCalledWith(
      expect.objectContaining({ prNumber: 7, headSha: 'sha-cached', checks: cachedChecks })
    )
  })
})
