// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  return {
    state,
    activateCyclableTab: vi.fn(),
    focusTerminalTabSurface: vi.fn(),
    focusGroup: vi.fn()
  }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/hooks/ipc-tab-switch', () => ({ activateCyclableTab: mocks.activateCyclableTab }))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({
  focusTerminalTabSurface: mocks.focusTerminalTabSurface
}))

import { focusTabGroupInDirection } from './focus-tab-group-in-direction'

function mountGroup(id: string, left: number, right: number): void {
  const body = document.createElement('div')
  body.dataset.tabGroupBodyId = id
  body.dataset.worktreeId = 'wt'
  body.getBoundingClientRect = () =>
    DOMRect.fromRect({ x: left, y: 0, width: right - left, height: 100 })
  document.body.append(body)
}

describe('focusTabGroupInDirection', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    mocks.state = {
      activeWorktreeId: 'wt',
      activeGroupIdByWorktree: { wt: 'left' },
      groupsByWorktree: {
        wt: [
          { id: 'left', activeTabId: 'tab-a' },
          { id: 'right', activeTabId: 'tab-b' }
        ]
      },
      unifiedTabsByWorktree: {
        wt: [
          { id: 'tab-a', entityId: 'term-a', contentType: 'terminal', groupId: 'left' },
          { id: 'tab-b', entityId: 'term-b', contentType: 'terminal', groupId: 'right' }
        ]
      },
      terminalLayoutsByTabId: { 'term-b': { activeLeafId: 'leaf-2' } },
      focusGroup: mocks.focusGroup
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('moves to the group on that side and focuses its terminal', () => {
    mountGroup('left', 0, 100)
    mountGroup('right', 104, 200)

    expect(focusTabGroupInDirection('right')).toBe('moved')
    expect(mocks.activateCyclableTab).toHaveBeenCalledWith(mocks.state, {
      type: 'terminal',
      id: 'term-b',
      tabId: 'tab-b'
    })
    expect(mocks.focusTerminalTabSurface).toHaveBeenCalledWith('term-b', 'leaf-2')
  })

  it('stays put at the edge', () => {
    mountGroup('left', 0, 100)
    mountGroup('right', 104, 200)

    expect(focusTabGroupInDirection('left')).toBe('edge')
    expect(mocks.activateCyclableTab).not.toHaveBeenCalled()
  })

  it('reports a single group so the chord can fall back to worktree history', () => {
    mountGroup('left', 0, 100)

    expect(focusTabGroupInDirection('right')).toBe('single-group')
  })
})
