// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readSummaries: vi.fn(),
  writeSummary: vi.fn()
}))

async function loadStore() {
  vi.resetModules()
  return import('./pending-review-summary-store')
}

describe('pending review summaries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.readSummaries.mockReset().mockResolvedValue({ 'wt-a': 'Saved summary' })
    mocks.writeSummary.mockReset().mockResolvedValue(undefined)
    Object.assign(window, {
      api: {
        pendingReview: { readSummaries: mocks.readSummaries, writeSummary: mocks.writeSummary }
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps each workspace’s summary to itself', async () => {
    const { usePendingReviewSummary, loadPendingReviewSummaries } = await loadStore()
    await loadPendingReviewSummaries()
    const a = renderHook(() => usePendingReviewSummary('wt-a'))
    const b = renderHook(() => usePendingReviewSummary('wt-b'))

    act(() => b.result.current[1]('Needs tests'))

    expect(a.result.current[0]).toBe('Saved summary')
    expect(b.result.current[0]).toBe('Needs tests')
  })

  it('saves shortly after typing stops, and at once when asked', async () => {
    const { setPendingReviewSummary, loadPendingReviewSummaries } = await loadStore()
    await loadPendingReviewSummaries()

    setPendingReviewSummary('wt-a', 'Draft')
    setPendingReviewSummary('wt-a', 'Draft, longer')
    expect(mocks.writeSummary).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(mocks.writeSummary).toHaveBeenCalledTimes(1)
    expect(mocks.writeSummary).toHaveBeenLastCalledWith('wt-a', 'Draft, longer')

    setPendingReviewSummary('wt-a', '', true)
    expect(mocks.writeSummary).toHaveBeenLastCalledWith('wt-a', '')
  })

  it('keeps text typed before the saved file finished loading', async () => {
    let resolve: (value: Record<string, string>) => void = () => undefined
    mocks.readSummaries.mockReturnValue(new Promise((r) => (resolve = r)))
    const { getLoadingForTests, setPendingReviewSummary, usePendingReviewSummary } =
      await loadStoreWithHelpers()
    setPendingReviewSummary('wt-a', 'Typed early')
    resolve({ 'wt-a': 'Older saved text' })
    await getLoadingForTests()

    const { result } = renderHook(() => usePendingReviewSummary('wt-a'))
    expect(result.current[0]).toBe('Typed early')
  })
})

async function loadStoreWithHelpers() {
  const store = await loadStore()
  const loading = store.loadPendingReviewSummaries()
  return { ...store, getLoadingForTests: () => loading }
}
