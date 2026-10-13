import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ run: vi.fn(), toastError: vi.fn() }))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      getKnownWorktreeById: (id: string) => (id === 'wt' ? { id, path: '/w/e-4861' } : undefined)
    })
  }
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))

import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type { WorkspaceStatusRuleCondition } from '../../../../shared/workspace-status-rule-config'
import { runReviewEnteredCommands } from './run-review-entered-commands'

const target = {
  worktreeId: 'wt',
  executionHostId: 'local' as const,
  displayName: 'e-4861',
  repo: { owner: 'flowbasedk', repo: 'flowbase' },
  prNumber: 3166,
  currentStatus: 'in-progress',
  headOid: 'abc',
  hasPendingReviewComments: false
}

function planWith(condition: WorkspaceStatusRuleCondition, executionHostId = 'local' as const) {
  return {
    statusUpdates: [{ worktreeId: 'wt', executionHostId, status: 'review', condition }],
    removals: [],
    creations: []
  }
}

function configWith(reviewEnteredCommand: string) {
  return { ...cloneDefaultWorkspaceStatusRuleConfig(), reviewEnteredCommand }
}

describe('runReviewEnteredCommands', () => {
  beforeEach(() => {
    mocks.run.mockReset().mockResolvedValue({ success: true, output: '' })
    mocks.toastError.mockReset()
    vi.stubGlobal('window', { api: { reviewStatusRules: { runWorkspaceCommand: mocks.run } } })
  })

  it('runs the command in the workspace when its pull request enters Review', async () => {
    await runReviewEnteredCommands(planWith('review'), [target], configWith('mise run bd'))

    expect(mocks.run).toHaveBeenCalledWith({ worktreePath: '/w/e-4861', command: 'mise run bd' })
  })

  it('does nothing without a command, or for other moves', async () => {
    await runReviewEnteredCommands(planWith('review'), [target], configWith(''))
    await runReviewEnteredCommands(planWith('conflicts'), [target], configWith('mise run bd'))

    expect(mocks.run).not.toHaveBeenCalled()
  })

  it('says which workspace failed and why', async () => {
    mocks.run.mockResolvedValue({ success: false, output: 'docker: not running' })
    await runReviewEnteredCommands(planWith('review'), [target], configWith('mise run bd'))

    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringContaining('e-4861'),
      expect.objectContaining({ description: 'docker: not running' })
    )
  })
})
