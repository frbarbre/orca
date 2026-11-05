import { describe, expect, it, vi } from 'vitest'
import { openReviewWorkspaceLayout } from './open-review-workspace-layout'

const SUMMARY = {
  baseRef: 'origin/main',
  baseOid: 'base',
  compareRef: 'feature',
  headOid: 'head',
  mergeBase: 'base',
  changedFiles: 2,
  status: 'ready' as const
}

const TARGET = {
  worktreeId: 'wt-1',
  worktreePath: '/work/review',
  agentTabId: 'agent-tab',
  baseRef: 'origin/main',
  prUrl: 'https://github.com/acme/app/pull/42'
}

type FakeTab = { id: string; groupId: string; contentType?: string; entityId?: string }

function fakeStore() {
  const tabs: FakeTab[] = [{ id: 'agent-tab', groupId: 'group-left' }]
  return {
    unifiedTabsByWorktree: { 'wt-1': tabs },
    ensureWorktreeRootGroup: vi.fn(() => 'group-root'),
    createEmptySplitGroup: vi.fn(() => 'group-right'),
    beginGitBranchCompareRequest: vi.fn(),
    setGitBranchCompareResult: vi.fn(),
    openBranchWorktreeDiff: vi.fn(),
    createBrowserTab: vi.fn(
      (_worktreeId: string, _url: string, options: { targetGroupId: string }) => {
        tabs.push({
          id: 'browser-tab',
          groupId: options.targetGroupId,
          contentType: 'browser',
          entityId: 'browser-workspace'
        })
        return { id: 'browser-workspace' }
      }
    ),
    activateTab: vi.fn()
  }
}

const BROWSER_TAB_SELECTED = ['browser-tab', { worktreeId: 'wt-1', recordFocus: false }]

function expectPullRequestOpenedOnTheRight(store: ReturnType<typeof fakeStore>): void {
  expect(store.createBrowserTab).toHaveBeenCalledWith(
    'wt-1',
    'https://github.com/acme/app/pull/42',
    { targetGroupId: 'group-right', activate: false }
  )
  expect(store.activateTab).toHaveBeenCalledWith(...BROWSER_TAB_SELECTED)
}

const LOCAL_TARGET = { kind: 'local' as const }

const AGENT_TAB_SELECTED = ['agent-tab', { worktreeId: 'wt-1', recordFocus: false }]

describe('openReviewWorkspaceLayout', () => {
  it("opens the PR's first file beside the review agent, split to its right", async () => {
    const store = fakeStore()
    const branchCompare = vi.fn(async () => ({
      summary: SUMMARY,
      entries: [
        { path: 'src/z.ts', status: 'modified' as const },
        { path: 'src/a.ts', status: 'added' as const }
      ]
    }))

    await openReviewWorkspaceLayout(TARGET, {
      getState: () => store as never,
      resolveTarget: () => LOCAL_TARGET,
      branchCompare
    })

    expect(branchCompare).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-1', worktreePath: '/work/review' }),
      'origin/main',
      'background'
    )
    expect(store.setGitBranchCompareResult).toHaveBeenCalled()
    expect(store.createEmptySplitGroup).toHaveBeenCalledWith('wt-1', 'group-left', 'right', {
      activate: false
    })
    expect(store.openBranchWorktreeDiff).toHaveBeenCalledWith(
      'wt-1',
      '/work/review',
      { path: 'src/a.ts', status: 'added' },
      SUMMARY,
      'typescript',
      { targetGroupId: 'group-right', preview: false }
    )
    // The setup and default tabs open in the agent's group too; the agent is the one shown there.
    expect(store.activateTab).toHaveBeenLastCalledWith(...AGENT_TAB_SELECTED)
    expect(store.activateTab.mock.invocationCallOrder[0]).toBeGreaterThan(
      store.openBranchWorktreeDiff.mock.invocationCallOrder[0]
    )
  })

  it('opens the PR on GitHub as the selected tab beside the first file', async () => {
    const store = fakeStore()
    await openReviewWorkspaceLayout(TARGET, {
      getState: () => store as never,
      resolveTarget: () => LOCAL_TARGET,
      branchCompare: async () => ({
        summary: SUMMARY,
        entries: [{ path: 'src/a.ts', status: 'added' as const }]
      })
    })

    expectPullRequestOpenedOnTheRight(store)
    expect(store.createEmptySplitGroup).toHaveBeenCalledTimes(1)
    expect(store.createBrowserTab.mock.invocationCallOrder[0]).toBeGreaterThan(
      store.openBranchWorktreeDiff.mock.invocationCallOrder[0]
    )
    expect(store.activateTab).toHaveBeenLastCalledWith(...AGENT_TAB_SELECTED)
  })

  it.each([
    ['the PR has no changed files', async () => ({ summary: SUMMARY, entries: [] })],
    [
      'the compare fails',
      async () => {
        throw new Error('no base')
      }
    ]
  ])('still opens the PR on the right when %s', async (_case, branchCompare) => {
    const store = fakeStore()
    await openReviewWorkspaceLayout(TARGET, {
      getState: () => store as never,
      resolveTarget: () => LOCAL_TARGET,
      branchCompare: branchCompare as never
    })

    expect(store.openBranchWorktreeDiff).not.toHaveBeenCalled()
    expect(store.createEmptySplitGroup).toHaveBeenCalledWith('wt-1', 'group-left', 'right', {
      activate: false
    })
    expectPullRequestOpenedOnTheRight(store)
    expect(store.activateTab).toHaveBeenLastCalledWith(...AGENT_TAB_SELECTED)
  })
})
