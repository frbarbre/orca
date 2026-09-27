import type { ExecutionHostId } from './execution-host'
import type { WorkspaceStatus } from './worktree/types'

export type WorkspaceHostStatusTarget = {
  worktreeId: string
  executionHostId: ExecutionHostId
  currentStatus: WorkspaceStatus | null
}

export type WorkspaceHostStatusUpdate = {
  worktreeId: string
  executionHostId: ExecutionHostId
  status: WorkspaceStatus
}

/** Moves each workspace on a host that has a column into that column, unless it is already there. */
export function planWorkspaceHostStatusUpdates(
  targets: readonly WorkspaceHostStatusTarget[],
  statusByHost: Readonly<Record<string, WorkspaceStatus>>
): WorkspaceHostStatusUpdate[] {
  const updates: WorkspaceHostStatusUpdate[] = []
  for (const target of targets) {
    const status = statusByHost[target.executionHostId]
    if (status && status !== target.currentStatus) {
      updates.push({
        worktreeId: target.worktreeId,
        executionHostId: target.executionHostId,
        status
      })
    }
  }
  return updates
}
