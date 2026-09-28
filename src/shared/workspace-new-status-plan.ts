import type { ExecutionHostId } from './execution-host'
import type { WorkspaceStatus } from './worktree/types'

export type NewWorkspaceStatusTarget = {
  worktreeId: string
  executionHostId: ExecutionHostId
  currentStatus: WorkspaceStatus | null
  /** When Orca created the workspace; absent for ones found on disk. */
  createdAt: number | null
}

export type NewWorkspaceStatusUpdate = {
  worktreeId: string
  executionHostId: ExecutionHostId
  status: WorkspaceStatus
}

/**
 * Starts each workspace Orca created after the setting was chosen in the chosen column.
 *
 * Why only unassigned ones: a workspace that already has a column was placed there on purpose,
 * by the user or by a rule, and a creation default must never pull it back.
 */
export function planNewWorkspaceStatusUpdates(
  targets: readonly NewWorkspaceStatusTarget[],
  status: WorkspaceStatus | null,
  since: number | null
): NewWorkspaceStatusUpdate[] {
  if (!status || since === null) {
    return []
  }
  return targets
    .filter(
      (target) =>
        target.currentStatus === null && target.createdAt !== null && target.createdAt >= since
    )
    .map((target) => ({
      worktreeId: target.worktreeId,
      executionHostId: target.executionHostId,
      status
    }))
}
