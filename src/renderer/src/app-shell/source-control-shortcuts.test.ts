import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getChangesFilter, isUncommittedOnly, setChangesFilter } from '@/lib/changes-filter'
import { publishPRCommentQueueContext } from '@/components/right-sidebar/pr-comment-queue-context'
import { setPRCommentsListGroupQueued } from '@/components/right-sidebar/pr-comments-list-selection'
import { consumeSendQueuedPRCommentsRequest } from '@/components/right-sidebar/queued-pr-comments-send'
import {
  consumeReviewSummaryFocusRequest,
  registerReviewSummary
} from '@/components/pending-review/review-summary-focus'
import { takeSourceControlShortcut } from './source-control-shortcuts'

const store = vi.hoisted(() => ({
  activeWorktreeId: 'wt-shortcut',
  rightSidebarOpen: true,
  rightSidebarTab: 'source-control',
  getKnownWorktreeById: () => ({ path: '/repo/wt-shortcut' }),
  setRightSidebarOpen: vi.fn(),
  setRightSidebarTab: vi.fn()
}))

vi.mock('../store', () => ({
  useAppStore: { getState: () => store }
}))

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const pullRequestUrl = vi.hoisted(() => ({ current: null as string | null }))
vi.mock('@/lib/worktree-pull-request-url', () => ({
  activeWorktreePullRequestUrl: () => pullRequestUrl.current
}))

const actions = { openDiffNotesSendMenuForActiveWorktree: () => false }

const frontend = vi.hoisted(() => ({ opened: true, open: vi.fn(() => frontend.opened) }))
vi.mock('@/lib/open-workspace-frontend', () => ({
  openActiveWorkspaceFrontend: frontend.open
}))

describe('frontend dev server shortcut', () => {
  beforeEach(() => vi.clearAllMocks())

  it("opens the active workspace's running frontend", () => {
    frontend.opened = true
    const match = (id: string): boolean => id === 'workspace.openFrontend'

    expect(takeSourceControlShortcut(match, true, actions)).toBe('workspace.openFrontend')
    expect(frontend.open).toHaveBeenCalledOnce()
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('says so when no frontend is running', () => {
    frontend.opened = false
    const match = (id: string): boolean => id === 'workspace.openFrontend'

    expect(takeSourceControlShortcut(match, true, actions)).toBe('workspace.openFrontend')
    expect(toast.info).toHaveBeenCalledWith('No frontend dev server is running.')
  })
})

describe('pull request shortcuts', () => {
  const openUrl = vi.fn(async () => {})
  const writeClipboardText = vi.fn(async () => {})
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { api: { shell: { openUrl }, ui: { writeClipboardText } } })
  })

  it("opens the active workspace's pull request on GitHub", () => {
    pullRequestUrl.current = 'https://github.com/acme/app/pull/7'
    const match = (id: string): boolean => id === 'sourceControl.openPullRequest'

    expect(takeSourceControlShortcut(match, true, actions)).toBe('sourceControl.openPullRequest')
    expect(openUrl).toHaveBeenCalledWith('https://github.com/acme/app/pull/7')
  })

  it("copies the active workspace's pull request URL", async () => {
    pullRequestUrl.current = 'https://github.com/acme/app/pull/7'
    const match = (id: string): boolean => id === 'sourceControl.copyPullRequestUrl'

    expect(takeSourceControlShortcut(match, true, actions)).toBe('sourceControl.copyPullRequestUrl')
    expect(writeClipboardText).toHaveBeenCalledWith('https://github.com/acme/app/pull/7')
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('says so when the workspace has no pull request', () => {
    pullRequestUrl.current = null
    const match = (id: string): boolean => id === 'sourceControl.copyPullRequestUrl'

    expect(takeSourceControlShortcut(match, true, actions)).toBe('sourceControl.copyPullRequestUrl')
    expect(writeClipboardText).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalled()
  })
})

describe('takeSourceControlShortcut', () => {
  it('toggles the uncommitted-only Changes filter for the active workspace', () => {
    const match = (id: string): boolean => id === 'sourceControl.toggleUncommittedOnly'
    expect(takeSourceControlShortcut(match, true, actions)).toBe(
      'sourceControl.toggleUncommittedOnly'
    )
    expect(isUncommittedOnly('wt-shortcut')).toBe(true)
    takeSourceControlShortcut(match, true, actions)
    expect(isUncommittedOnly('wt-shortcut')).toBe(false)
  })

  it('turns the latest agent turn off when it is already showing', () => {
    const turn = {
      kind: 'turn' as const,
      compare: { commitOid: 'c2', parentOid: 'c1', compareRef: 'c2', baseRef: 'c1' },
      entries: [],
      prompt: 'Fix the parser',
      latest: true
    }
    vi.stubGlobal('window', {})
    setChangesFilter('wt-shortcut', turn)
    const match = (id: string): boolean => id === 'sourceControl.openLatestAgentTurn'
    expect(takeSourceControlShortcut(match, true, actions)).toBe(
      'sourceControl.openLatestAgentTurn'
    )
    expect(getChangesFilter('wt-shortcut')).toBeNull()
    vi.unstubAllGlobals()
  })

  describe('revealing Source Control', () => {
    beforeEach(() => {
      store.setRightSidebarOpen.mockClear()
      store.setRightSidebarTab.mockClear()
    })

    function expectSourceControlRevealed(): void {
      expect(store.setRightSidebarOpen).toHaveBeenCalledWith(true)
      expect(store.setRightSidebarTab).toHaveBeenCalledWith('source-control')
    }

    it('switches to Source Control when toggling uncommitted-only', () => {
      const match = (id: string): boolean => id === 'sourceControl.toggleUncommittedOnly'
      takeSourceControlShortcut(match, true, actions)
      expectSourceControlRevealed()
      takeSourceControlShortcut(match, true, actions)
    })

    it('switches to Source Control before the latest turn has loaded', () => {
      vi.stubGlobal('window', {
        api: {
          agentTurns: { list: () => new Promise(() => {}) },
          git: { commitCompare: vi.fn() }
        }
      })
      const match = (id: string): boolean => id === 'sourceControl.openLatestAgentTurn'
      expect(takeSourceControlShortcut(match, true, actions)).toBe(
        'sourceControl.openLatestAgentTurn'
      )
      expectSourceControlRevealed()
      vi.unstubAllGlobals()
    })

    it('leaves the sidebar alone where it cannot be shown', () => {
      const match = (id: string): boolean => id === 'sourceControl.toggleUncommittedOnly'
      takeSourceControlShortcut(match, false, actions)
      takeSourceControlShortcut(match, false, actions)
      expect(store.setRightSidebarOpen).not.toHaveBeenCalled()
      expect(store.setRightSidebarTab).not.toHaveBeenCalled()
    })
  })

  it('opens the PR panel to send the queued comments from any panel', () => {
    publishPRCommentQueueContext('wt-shortcut', 'shortcut-key')
    setPRCommentsListGroupQueued('shortcut-key', 'thread:T1', true)
    const match = (id: string): boolean => id === 'sourceControl.sendQueuedComments'
    expect(takeSourceControlShortcut(match, true, actions)).toBe('sourceControl.sendQueuedComments')
    expect(store.setRightSidebarOpen).toHaveBeenCalledWith(true)
    expect(store.setRightSidebarTab).toHaveBeenCalledWith('checks')
    expect(consumeSendQueuedPRCommentsRequest('wt-shortcut')).toBe(true)
  })

  describe('focus review summary', () => {
    const match = (id: string): boolean => id === 'sourceControl.focusReviewSummary'

    it('asks the open Source Control panel to focus its review summary', () => {
      const unregister = registerReviewSummary('wt-shortcut')
      expect(takeSourceControlShortcut(match, true, actions)).toBe(
        'sourceControl.focusReviewSummary'
      )
      expect(consumeReviewSummaryFocusRequest('wt-shortcut')).toBe(true)
      unregister()
    })

    it('leaves the chord alone when the Source Control panel is not showing', () => {
      const unregister = registerReviewSummary('wt-shortcut')
      store.rightSidebarTab = 'checks'
      expect(takeSourceControlShortcut(match, true, actions)).toBeNull()
      store.rightSidebarTab = 'source-control'
      store.rightSidebarOpen = false
      expect(takeSourceControlShortcut(match, true, actions)).toBeNull()
      store.rightSidebarOpen = true
      expect(consumeReviewSummaryFocusRequest('wt-shortcut')).toBe(false)
      unregister()
    })

    it('leaves the chord alone when the panel has no Review section', () => {
      expect(takeSourceControlShortcut(match, true, actions)).toBeNull()
      expect(consumeReviewSummaryFocusRequest('wt-shortcut')).toBe(false)
    })
  })
})
