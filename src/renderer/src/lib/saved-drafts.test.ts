// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reloadSavedDraftsForTests, useSavedDraft } from './saved-drafts'

afterEach(() => {
  localStorage.clear()
  reloadSavedDraftsForTests()
})

describe('useSavedDraft', () => {
  it('keeps what was typed across a restart', () => {
    const first = renderHook(() => useSavedDraft('reply:1'))
    act(() => first.result.current[1]('Half a thought'))
    first.unmount()

    reloadSavedDraftsForTests()
    const second = renderHook(() => useSavedDraft('reply:1'))
    expect(second.result.current[0]).toBe('Half a thought')
    expect(renderHook(() => useSavedDraft('reply:2')).result.current[0]).toBe('')
  })

  it('forgets the draft once the box is emptied, as after sending', () => {
    const { result } = renderHook(() => useSavedDraft('reply:1'))
    act(() => result.current[1]('Sent soon'))
    act(() => result.current[1](''))

    reloadSavedDraftsForTests()
    expect(renderHook(() => useSavedDraft('reply:1')).result.current[0]).toBe('')
  })

  it('drops drafts nobody has touched for a month', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z')
    vi.useFakeTimers({ now, toFake: ['Date'] })
    try {
      localStorage.setItem(
        'orca.savedDrafts.v1',
        JSON.stringify({
          stale: { text: 'old', savedAt: now - 31 * 24 * 60 * 60 * 1000 },
          fresh: { text: 'new', savedAt: now }
        })
      )
      reloadSavedDraftsForTests()
      expect(renderHook(() => useSavedDraft('stale')).result.current[0]).toBe('')
      expect(renderHook(() => useSavedDraft('fresh')).result.current[0]).toBe('new')
    } finally {
      vi.useRealTimers()
    }
  })
})
