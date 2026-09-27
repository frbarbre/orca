import { describe, expect, it } from 'vitest'
import { planWorkspaceHostStatusUpdates } from './workspace-host-status-plan'

const HELIOS = 'runtime:helios-env'

describe('planWorkspaceHostStatusUpdates', () => {
  it('moves a workspace on a mapped host into that column', () => {
    expect(
      planWorkspaceHostStatusUpdates(
        [{ worktreeId: 'wt-1', executionHostId: HELIOS, currentStatus: 'in-progress' }],
        { [HELIOS]: 'status-7' }
      )
    ).toEqual([{ worktreeId: 'wt-1', executionHostId: HELIOS, status: 'status-7' }])
  })

  it('moves a workspace that has no status yet', () => {
    expect(
      planWorkspaceHostStatusUpdates(
        [{ worktreeId: 'wt-1', executionHostId: HELIOS, currentStatus: null }],
        { [HELIOS]: 'status-7' }
      )
    ).toHaveLength(1)
  })

  it('leaves workspaces already in the column, and those on unmapped hosts', () => {
    expect(
      planWorkspaceHostStatusUpdates(
        [
          { worktreeId: 'wt-1', executionHostId: HELIOS, currentStatus: 'status-7' },
          { worktreeId: 'wt-2', executionHostId: 'local', currentStatus: 'todo' },
          { worktreeId: 'wt-3', executionHostId: 'ssh:box', currentStatus: 'todo' }
        ],
        { [HELIOS]: 'status-7' }
      )
    ).toEqual([])
  })
})
