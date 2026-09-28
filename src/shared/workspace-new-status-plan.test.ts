import { describe, expect, it } from 'vitest'
import { planNewWorkspaceStatusUpdates } from './workspace-new-status-plan'

const SINCE = 1_000

describe('planNewWorkspaceStatusUpdates', () => {
  it('starts a workspace created after the setting in the chosen column', () => {
    expect(
      planNewWorkspaceStatusUpdates(
        [{ worktreeId: 'wt-1', executionHostId: 'local', currentStatus: null, createdAt: 2_000 }],
        'todo',
        SINCE
      )
    ).toEqual([{ worktreeId: 'wt-1', executionHostId: 'local', status: 'todo' }])
  })

  it('leaves older, undated and already placed workspaces alone', () => {
    expect(
      planNewWorkspaceStatusUpdates(
        [
          { worktreeId: 'old', executionHostId: 'local', currentStatus: null, createdAt: 500 },
          { worktreeId: 'found', executionHostId: 'local', currentStatus: null, createdAt: null },
          {
            worktreeId: 'placed',
            executionHostId: 'local',
            currentStatus: 'status-6',
            createdAt: 2_000
          }
        ],
        'todo',
        SINCE
      )
    ).toEqual([])
  })

  it('does nothing until a column is chosen', () => {
    expect(
      planNewWorkspaceStatusUpdates(
        [{ worktreeId: 'wt-1', executionHostId: 'local', currentStatus: null, createdAt: 2_000 }],
        null,
        null
      )
    ).toEqual([])
  })
})
