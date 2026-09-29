// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return { state }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/hooks/useShortcutLabel', () => ({ getShortcutPlatform: () => 'darwin' }))

import { useRunQuickCommandShortcut } from './use-run-quick-command-shortcut'

function pressCmdR(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'r',
    code: 'KeyR',
    metaKey: true,
    bubbles: true,
    cancelable: true
  })
  window.dispatchEvent(event)
  return event
}

describe('useRunQuickCommandShortcut', () => {
  afterEach(() => vi.restoreAllMocks())

  it('runs the selected command from the focused group on Cmd+R', () => {
    Object.assign(mocks.state, {
      activeWorktreeId: 'wt',
      activeGroupIdByWorktree: { wt: 'g1' },
      keybindings: { 'tab.runQuickCommand': ['Mod+R'] }
    })
    const onRun = vi.fn()
    renderHook(() => useRunQuickCommandShortcut({ worktreeId: 'wt', groupId: 'g1', onRun }))

    expect(pressCmdR().defaultPrevented).toBe(true)
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('leaves the chord to the focused group when this one is not it', () => {
    Object.assign(mocks.state, {
      activeWorktreeId: 'wt',
      activeGroupIdByWorktree: { wt: 'g2' },
      keybindings: { 'tab.runQuickCommand': ['Mod+R'] }
    })
    const onRun = vi.fn()
    renderHook(() => useRunQuickCommandShortcut({ worktreeId: 'wt', groupId: 'g1', onRun }))

    expect(pressCmdR().defaultPrevented).toBe(false)
    expect(onRun).not.toHaveBeenCalled()
  })
})
