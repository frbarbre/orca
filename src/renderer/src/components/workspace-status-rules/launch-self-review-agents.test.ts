import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ launch: vi.fn(), view: vi.fn(), layout: vi.fn() }))

vi.mock('@/lib/launch-agent-background-session', () => ({
  launchAgentBackgroundSession: mocks.launch
}))
vi.mock('./apply-review-agent-view', () => ({ applyReviewAgentView: mocks.view }))
vi.mock('./open-review-workspace-layout', () => ({ openReviewWorkspaceLayout: mocks.layout }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      getKnownWorktreeById: (id: string) => (id === 'wt' ? { id, path: '/w/e-7300' } : undefined)
    })
  }
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, vars?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(vars?.[name] ?? ''))
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type { WorkspaceStatusRuleCondition } from '../../../../shared/workspace-status-rule-config'
import { launchSelfReviewAgents } from './launch-self-review-agents'

const repo = { owner: 'flowbasedk', repo: 'flowbase' }
const target = {
  worktreeId: 'wt',
  executionHostId: 'local' as const,
  displayName: 'e-7300',
  repo,
  prNumber: 4279,
  currentStatus: 'review',
  headOid: 'abc',
  hasPendingReviewComments: false
}
const snapshot = {
  linkedPullRequests: [
    {
      repo,
      number: 4279,
      title: 'Add a thing',
      url: 'https://github.com/flowbasedk/flowbase/pull/4279',
      author: 'frbarbre',
      isDraft: false,
      state: 'OPEN' as const,
      headRefName: 'feature/e-7300',
      baseRefName: 'main',
      headRefOid: 'abc',
      requestedReviewers: [],
      latestReviews: [],
      checks: []
    }
  ]
}

function planWith(condition: WorkspaceStatusRuleCondition) {
  return {
    statusUpdates: [
      { worktreeId: 'wt', executionHostId: 'local' as const, status: condition, condition }
    ],
    removals: [],
    creations: []
  }
}

describe('launchSelfReviewAgents', () => {
  beforeEach(() => {
    mocks.launch.mockReset().mockResolvedValue({ tabId: 'tab-1', paneKey: 'tab-1:pane' })
    mocks.view.mockReset()
    mocks.layout.mockReset().mockResolvedValue(undefined)
  })

  it('runs the first-review prompt in the workspace and opens the review layout', async () => {
    const config = {
      ...cloneDefaultWorkspaceStatusRuleConfig(),
      reviewInbox: {
        ...cloneDefaultWorkspaceStatusRuleConfig().reviewInbox,
        agent: 'codex' as const,
        view: 'terminal' as const,
        promptTemplate: 'Review #{{prNumber}} on {{branch}} against {{baseRef}}.'
      }
    }
    await launchSelfReviewAgents(planWith('self-review'), [target], snapshot, config)

    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(mocks.launch.mock.calls[0]?.[0]).toMatchObject({
      agent: 'codex',
      worktreeId: 'wt',
      prompt: 'Review #4279 on feature/e-7300 against main.',
      title: 'Self review #4279'
    })
    expect(mocks.view).toHaveBeenCalledWith({ tabId: 'tab-1', paneKey: 'tab-1:pane' }, 'terminal')
    expect(mocks.layout).toHaveBeenCalledWith({
      worktreeId: 'wt',
      worktreePath: '/w/e-7300',
      agentTabId: 'tab-1',
      baseRef: 'origin/main',
      prUrl: 'https://github.com/flowbasedk/flowbase/pull/4279'
    })
  })

  it('does nothing for other moves', async () => {
    await launchSelfReviewAgents(
      planWith('review'),
      [target],
      snapshot,
      cloneDefaultWorkspaceStatusRuleConfig()
    )

    expect(mocks.launch).not.toHaveBeenCalled()
  })
})
