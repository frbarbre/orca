import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('@/lib/launch-agent-background-session', () => ({
  launchAgentBackgroundSession: mocks.launch
}))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      getKnownWorktreeById: (id: string) => (id === 'wt' ? { id, path: '/w/e-4861' } : undefined)
    })
  }
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import { launchConflictAgents } from './launch-conflict-agents'

const repo = { owner: 'flowbasedk', repo: 'flowbase' }
const target = {
  worktreeId: 'wt',
  executionHostId: 'local' as const,
  displayName: 'e-4861',
  repo,
  prNumber: 3166,
  currentStatus: 'review',
  hasPendingReviewComments: false
}
const snapshot = {
  linkedPullRequests: [
    {
      repo,
      number: 3166,
      title: '',
      url: '',
      author: 'frbarbre',
      isDraft: false,
      state: 'OPEN' as const,
      headRefName: 'feature/e-4861',
      baseRefName: 'main',
      headRefOid: 'abc',
      requestedReviewers: [],
      latestReviews: [],
      checks: []
    }
  ]
}

function planWith(condition: 'conflicts' | 'review') {
  return {
    statusUpdates: [
      { worktreeId: 'wt', executionHostId: 'local' as const, status: condition, condition }
    ],
    removals: [],
    creations: []
  }
}

describe('launchConflictAgents', () => {
  beforeEach(() => {
    mocks.launch.mockReset().mockResolvedValue(null)
  })

  it('starts an agent that merges the base and pushes when a pull request enters Conflicts', async () => {
    const config = { ...cloneDefaultWorkspaceStatusRuleConfig(), resolveConflictsWithAgent: true }
    await launchConflictAgents(planWith('conflicts'), [target], snapshot, config)

    expect(mocks.launch).toHaveBeenCalledTimes(1)
    const call = mocks.launch.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      worktreeId: 'wt',
      agent: 'claude',
      launchSource: 'conflict_resolution'
    })
    expect(call.prompt).toContain('git fetch origin main')
    expect(call.prompt).toContain('plain git push')
  })

  it('does nothing while the option is off, or for other moves', async () => {
    await launchConflictAgents(
      planWith('conflicts'),
      [target],
      snapshot,
      cloneDefaultWorkspaceStatusRuleConfig()
    )
    const config = { ...cloneDefaultWorkspaceStatusRuleConfig(), resolveConflictsWithAgent: true }
    await launchConflictAgents(planWith('review'), [target], snapshot, config)

    expect(mocks.launch).not.toHaveBeenCalled()
  })
})
