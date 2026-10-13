// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activeGroupIdByWorktree: { 'wt-1': 'group-a' } as Record<string, string>
}))

vi.mock('../../store', () => ({
  useAppStore: { getState: () => ({ activeGroupIdByWorktree: mocks.activeGroupIdByWorktree }) }
}))

import { requestCloseOtherTabs, subscribeCloseOtherTabs } from './close-other-tabs-request'

describe('close other tabs request', () => {
  it('closes the others around the active tab of the focused group only', () => {
    const focused = vi.fn()
    const other = vi.fn()
    const elsewhere = vi.fn()
    const unsubscribers = [
      subscribeCloseOtherTabs('wt-1', 'group-a', focused),
      subscribeCloseOtherTabs('wt-1', 'group-b', other),
      subscribeCloseOtherTabs('wt-2', 'group-a', elsewhere)
    ]

    requestCloseOtherTabs('wt-1')

    expect(focused).toHaveBeenCalledOnce()
    expect(other).not.toHaveBeenCalled()
    expect(elsewhere).not.toHaveBeenCalled()
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  })

  it('stops listening once unsubscribed', () => {
    const focused = vi.fn()
    subscribeCloseOtherTabs('wt-1', 'group-a', focused)()

    requestCloseOtherTabs('wt-1')

    expect(focused).not.toHaveBeenCalled()
  })
})
