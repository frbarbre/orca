import { toast } from 'sonner'
import { useAppStore } from '@/store'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type { WorkspaceStatusRulePlan } from '../../../../shared/workspace-status-rule-plan'
import { createReviewWorkspace } from './create-review-workspace'

async function applyStatusUpdates(plan: WorkspaceStatusRulePlan): Promise<void> {
  const { updateWorktreeMeta } = useAppStore.getState()
  await Promise.all(
    plan.statusUpdates.map((update) =>
      updateWorktreeMeta(
        update.worktreeId,
        { workspaceStatus: update.status },
        { executionHostId: update.executionHostId }
      )
    )
  )
}

async function applyRemovals(plan: WorkspaceStatusRulePlan): Promise<void> {
  const { removeWorktree } = useAppStore.getState()
  for (const removal of plan.removals) {
    // Why force stays off: Git refuses a checkout holding uncommitted work or a
    // live agent session, and that refusal is the safety net for an automatic
    // delete. The archive hook runs either way.
    const result = await removeWorktree(
      { id: removal.worktreeId, executionHostId: removal.executionHostId },
      false
    )
    if (!result.ok) {
      toast.error(`Kept ${removal.displayName}: ${result.error}`)
    }
  }
}

async function applyCreations(
  plan: WorkspaceStatusRulePlan,
  config: WorkspaceStatusRuleConfig
): Promise<void> {
  for (const creation of plan.creations) {
    const result = await createReviewWorkspace(creation.pr, config)
    // Why mark on failure too: a create that cannot succeed (no matching
    // project, a branch Git refuses) would otherwise retry every minute.
    useAppStore.getState().markPullRequestHandled([creation.handledKey])
    if (result.ok) {
      toast.success(`Reviewing #${creation.pr.number} — ${creation.pr.title}`)
    } else {
      toast.error(`Could not open a review workspace for #${creation.pr.number}: ${result.error}`)
    }
  }
}

export async function applyWorkspaceStatusRulePlan(
  plan: WorkspaceStatusRulePlan,
  config: WorkspaceStatusRuleConfig
): Promise<void> {
  await applyStatusUpdates(plan)
  await applyRemovals(plan)
  await applyCreations(plan, config)
}
