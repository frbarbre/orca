import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { subscribe: vi.fn() } }))

import {
  noteWokenPanes,
  paneWakeCount,
  resetWokenPanesForTests,
  tabHasWokenPane
} from './claude-web-woken-panes'

const LEAF = '6af0a095-c76d-45eb-a6ec-cdcb4af29cb9'
const record = { worktreeId: 'wt', agent: 'claude' }

describe('panes woken from sleep this run', () => {
  beforeEach(() => resetWokenPanesForTests())

  it('marks a pane whose sleeping record was cleared', () => {
    noteWokenPanes({ [`tab-1:${LEAF}`]: record }, {})

    expect(tabHasWokenPane('tab-1')).toBe(true)
    expect(tabHasWokenPane('tab-2')).toBe(false)
  })

  it('counts every wake of the same pane, so each can open the web view again', () => {
    expect(paneWakeCount(`tab-1:${LEAF}`)).toBe(0)
    noteWokenPanes({ [`tab-1:${LEAF}`]: record }, {})
    noteWokenPanes({ [`tab-1:${LEAF}`]: record }, {})

    expect(paneWakeCount(`tab-1:${LEAF}`)).toBe(2)
  })

  it('leaves a pane that is still asleep or newly put to sleep', () => {
    noteWokenPanes({ [`tab-1:${LEAF}`]: record }, { [`tab-1:${LEAF}`]: record })
    noteWokenPanes({}, { [`tab-2:${LEAF}`]: record })

    expect(tabHasWokenPane('tab-1')).toBe(false)
    expect(tabHasWokenPane('tab-2')).toBe(false)
  })
})
