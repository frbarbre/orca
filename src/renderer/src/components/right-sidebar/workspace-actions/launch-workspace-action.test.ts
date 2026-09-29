import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const context: Record<string, unknown> = {}
  return {
    context,
    launch: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveTabType: vi.fn()
  }
})

vi.mock('./workspace-action-context', () => ({
  selectWorkspaceActionContext: () => mocks.context
}))
vi.mock('@/lib/launch-agent-background-session', () => ({
  launchAgentBackgroundSession: mocks.launch
}))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      settings: {
        sourceControlAi: {
          prCreationDefaults: { draft: true, useTemplate: true },
          instructionsByOperation: { pullRequest: 'Titles use feat(scope):' }
        }
      },
      workspaceStatusRules: { actionPrompts: {}, reviewInbox: { agent: 'claude' } },
      gitConflictOperationByWorktree: {},
      setActiveTab: mocks.setActiveTab,
      setActiveTabType: mocks.setActiveTabType
    })
  }
}))

import { launchWorkspaceAction } from './launch-workspace-action'

function setContext(overrides: Record<string, unknown>): void {
  for (const key of Object.keys(mocks.context)) {
    delete mocks.context[key]
  }
  Object.assign(mocks.context, {
    worktree: { id: 'wt', path: '/w/e-4861', baseRef: 'origin/main' },
    repo: { id: 'r' },
    branch: 'feature/e-4861',
    pr: null,
    unresolvedConflicts: [],
    action: 'create-pull-request',
    ...overrides
  })
}

describe('launchWorkspaceAction', () => {
  beforeEach(() => {
    mocks.launch.mockReset().mockResolvedValue({ tabId: 'tab-1' })
  })

  it('creates the pull request with the pull request settings and instructions', async () => {
    setContext({})
    await launchWorkspaceAction('primary')

    const call = mocks.launch.mock.calls[0]?.[0]
    expect(call).toMatchObject({ agent: 'claude', worktreeId: 'wt', title: 'Create PR' })
    expect(call.prompt).toContain('targeting main')
    expect(call.prompt).toContain('as a draft')
    expect(call.prompt).toContain('Titles use feat(scope):')
    expect(mocks.setActiveTab).toHaveBeenCalledWith('tab-1')
  })

  it('resolves pull request conflicts with the Source Control conflict prompt', async () => {
    setContext({
      action: 'resolve-conflicts',
      pr: { number: 3145, state: 'open', baseRefName: 'main', url: '', title: '' }
    })
    await launchWorkspaceAction('primary')
    expect(mocks.launch.mock.calls[0]?.[0].prompt).toContain('Resolve the merge conflicts')
  })

  it('reviews the current pull request', async () => {
    setContext({
      action: null,
      pr: {
        number: 3145,
        state: 'open',
        baseRefName: 'main',
        url: 'https://x/3145',
        title: 'Scale'
      }
    })
    await launchWorkspaceAction('review')
    const call = mocks.launch.mock.calls[0]?.[0]
    expect(call.title).toBe('Review #3145')
    expect(call.prompt).toContain('Review pull request #3145 — "Scale"')
  })

  it('does nothing without an action or a pull request to review', async () => {
    setContext({ action: null })
    await launchWorkspaceAction('primary')
    await launchWorkspaceAction('review')
    expect(mocks.launch).not.toHaveBeenCalled()
  })
})
