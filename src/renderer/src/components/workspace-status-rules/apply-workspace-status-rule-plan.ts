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

/** Why in memory and not the persisted ledger: a create that fails for a passing
 *  reason (a fetch that timed out, gh not yet authenticated) must not burn the
 *  pull request forever. Restarting Orca retries it. */
const failedCreateAttempts = new Map<string, number>()
const MAX_CREATE_ATTEMPTS = 3

async function applyCreations(
  plan: WorkspaceStatusRulePlan,
  config: WorkspaceStatusRuleConfig
): Promise<void> {
  for (const creation of plan.creations) {
    const attempts = failedCreateAttempts.get(creation.handledKey) ?? 0
    if (attempts >= MAX_CREATE_ATTEMPTS) {
      continue
    }
    const result = await createReviewWorkspace(creation.pr, config)
    if (result.ok) {
      failedCreateAttempts.delete(creation.handledKey)
      useAppStore.getState().markPullRequestHandled([creation.handledKey])
      toast.success(`Reviewing #${creation.pr.number} — ${creation.pr.title}`)
      continue
    }
    failedCreateAttempts.set(creation.handledKey, attempts + 1)
    console.error(
      `[workspace-status-rules] review workspace for #${creation.pr.number} failed ` +
        `(attempt ${attempts + 1}/${MAX_CREATE_ATTEMPTS}):`,
      result.error
    )
    if (attempts + 1 >= MAX_CREATE_ATTEMPTS) {
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
