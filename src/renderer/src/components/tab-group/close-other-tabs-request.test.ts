// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activeGroupIdByWorktree: { 'wt-1': 'group-a' } as Record<string, string>,
  findBusyTerminalTabIds: vi.fn(async () => new Set(['term-build']))
}))

vi.mock('../../store', () => ({
  useAppStore: { getState: () => ({ activeGroupIdByWorktree: mocks.activeGroupIdByWorktree }) }
}))
vi.mock('../terminal/busy-terminal-tabs', () => ({
  findBusyTerminalTabIds: mocks.findBusyTerminalTabIds
}))

import { renderHook } from '@testing-library/react'
import {
  requestCloseOtherTabs,
  subscribeCloseOtherTabs,
  useCloseOtherTabsRequest
} from './close-other-tabs-request'

describe('close other tabs request', () => {
  function handlers() {
    return { keepActive: vi.fn(), closeAll: vi.fn() }
  }

  it('keeps the active tab of the focused group and empties every other group of the workspace', () => {
    const focused = handlers()
    const split = handlers()
    const elsewhere = handlers()
    const unsubscribers = [
      subscribeCloseOtherTabs('wt-1', 'group-a', focused),
      subscribeCloseOtherTabs('wt-1', 'group-b', split),
      subscribeCloseOtherTabs('wt-2', 'group-a', elsewhere)
    ]

    requestCloseOtherTabs('wt-1')

    expect(focused.keepActive).toHaveBeenCalledOnce()
    expect(focused.closeAll).not.toHaveBeenCalled()
    expect(split.closeAll).toHaveBeenCalledOnce()
    expect(split.keepActive).not.toHaveBeenCalled()
    expect(elsewhere.keepActive).not.toHaveBeenCalled()
    expect(elsewhere.closeAll).not.toHaveBeenCalled()
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  })

  it('keeps terminal tabs with a running process open, in the focused group and every other', async () => {
    const commands = { closeOthers: vi.fn(), closeAllUnpinned: vi.fn() }
    const groupTabs = [{ id: 'term-build' }, { id: 'term-shell' }] as never
    renderHook(() =>
      useCloseOtherTabsRequest('wt-1', 'group-a', {
        activeTab: { id: 'term-shell' },
        groupTabs,
        commands
      })
    )
    renderHook(() =>
      useCloseOtherTabsRequest('wt-1', 'group-b', { activeTab: null, groupTabs, commands })
    )

    requestCloseOtherTabs('wt-1')

    await vi.waitFor(() => expect(commands.closeAllUnpinned).toHaveBeenCalled())
    await vi.waitFor(() => expect(commands.closeOthers).toHaveBeenCalled())
    expect(mocks.findBusyTerminalTabIds).toHaveBeenCalledWith(groupTabs)
    expect(commands.closeOthers).toHaveBeenCalledWith('term-shell', new Set(['term-build']))
    expect(commands.closeAllUnpinned).toHaveBeenCalledWith(new Set(['term-build']))
  })

  it('stops listening once unsubscribed', () => {
    const focused = handlers()
    subscribeCloseOtherTabs('wt-1', 'group-a', focused)()

    requestCloseOtherTabs('wt-1')

    expect(focused.keepActive).not.toHaveBeenCalled()
  })
})
