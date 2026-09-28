import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewSnapshotPullRequest } from '../../../../shared/github/review-status-snapshot-types'
import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'

const mocks = vi.hoisted(() => ({
  createWorktree: vi.fn(),
  ensureHooksConfirmed: vi.fn(),
  launchWorktreeBackgroundTerminals: vi.fn(),
  launchAgentBackgroundSession: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      settings: null,
      repos: [{ id: 'repo-1', path: '/work/flowbasedk/flowbase' }],
      createWorktree: mocks.createWorktree
    })
  }
}))
vi.mock('@/lib/github-pr-start-point', () => ({
  resolveGitHubPrStartPointForRepo: async () => ({
    baseBranch: 'origin/feature',
    pushTarget: undefined,
    branchNameOverride: undefined,
    compareBaseRef: 'origin/main'
  })
}))
vi.mock('@/lib/ensure-hooks-confirmed', () => ({
  ensureHooksConfirmed: mocks.ensureHooksConfirmed
}))
vi.mock('@/lib/launch-worktree-background-terminals', () => ({
  launchWorktreeBackgroundTerminals: mocks.launchWorktreeBackgroundTerminals
}))
vi.mock('@/lib/launch-agent-background-session', () => ({
  launchAgentBackgroundSession: mocks.launchAgentBackgroundSession
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

import { createReviewWorkspace } from './create-review-workspace'

const PR: ReviewSnapshotPullRequest = {
  repo: { owner: 'flowbasedk', repo: 'flowbase' },
  number: 3170,
  title: 'Add scale mode',
  url: 'https://github.com/flowbasedk/flowbase/pull/3170',
  author: 'colleague',
  isDraft: false,
  state: 'OPEN',
  headRefName: 'feature',
  baseRefName: 'main',
  headRefOid: 'abc123',
  requestedReviewers: [],
  latestReviews: [],
  checks: []
}

const SETUP = { runnerScriptPath: '/tmp/setup.sh', envVars: {} }

function config() {
  return { ...cloneDefaultWorkspaceStatusRuleConfig(), repoIds: ['repo-1'] }
}

describe('createReviewWorkspace', () => {
  beforeEach(() => {
    mocks.createWorktree.mockReset().mockResolvedValue({ worktree: { id: 'wt-1' }, setup: SETUP })
    mocks.ensureHooksConfirmed.mockReset()
    mocks.launchWorktreeBackgroundTerminals.mockReset().mockResolvedValue(undefined)
    mocks.launchAgentBackgroundSession.mockReset().mockResolvedValue(undefined)
  })

  it('runs a trusted setup script in a Setup tab beside the review agent', async () => {
    mocks.ensureHooksConfirmed.mockResolvedValue('run')

    const result = await createReviewWorkspace(PR, config())

    expect(result).toEqual({ ok: true, worktreeId: 'wt-1' })
    expect(mocks.ensureHooksConfirmed).toHaveBeenCalledWith(expect.anything(), 'repo-1', 'setup')
    expect(mocks.createWorktree.mock.calls[0]?.[3]).toBe('run')
    expect(mocks.launchWorktreeBackgroundTerminals).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      setup: SETUP,
      defaultTabs: undefined
    })
    expect(mocks.launchAgentBackgroundSession).toHaveBeenCalled()
  })

  it('skips setup the user has not trusted', async () => {
    mocks.ensureHooksConfirmed.mockResolvedValue('skip')
    mocks.createWorktree.mockResolvedValue({ worktree: { id: 'wt-1' } })

    await createReviewWorkspace(PR, config())

    expect(mocks.createWorktree.mock.calls[0]?.[3]).toBe('skip')
    expect(mocks.launchWorktreeBackgroundTerminals).not.toHaveBeenCalled()
    expect(mocks.launchAgentBackgroundSession).toHaveBeenCalled()
  })
})
