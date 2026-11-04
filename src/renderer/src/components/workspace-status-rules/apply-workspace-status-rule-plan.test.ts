import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  removeWorktree: vi.fn(async () => ({ ok: true })),
  forgetPullRequestHandled: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      removeWorktree: mocks.removeWorktree,
      forgetPullRequestHandled: mocks.forgetPullRequestHandled,
      updateWorktreeMeta: vi.fn()
    })
  }
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('./create-review-workspace', () => ({ createReviewWorkspace: vi.fn() }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { applyWorkspaceStatusRulePlan } from './apply-workspace-status-rule-plan'
import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'

describe('applyWorkspaceStatusRulePlan', () => {
  beforeEach(() => mocks.removeWorktree.mockClear())

  it('forces only the removals the plan marks as forced', async () => {
    await applyWorkspaceStatusRulePlan(
      {
        statusUpdates: [],
        creations: [],
        removals: [
          { worktreeId: 'mine', executionHostId: 'local', displayName: 'mine' },
          { worktreeId: 'review', executionHostId: 'local', displayName: 'review', force: true }
        ]
      },
      cloneDefaultWorkspaceStatusRuleConfig()
    )

    expect(mocks.removeWorktree.mock.calls).toEqual([
      [{ id: 'mine', executionHostId: 'local' }, false],
      [{ id: 'review', executionHostId: 'local' }, true]
    ])
  })
})
