import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type {
  WorkspaceStatusRulePlan,
  WorkspaceStatusRuleTarget
} from '../../../../shared/workspace-status-rule-plan'

export async function runReviewEnteredCommands(
  plan: WorkspaceStatusRulePlan,
  targets: readonly WorkspaceStatusRuleTarget[],
  config: WorkspaceStatusRuleConfig
): Promise<void> {
  const command = config.reviewEnteredCommand.trim()
  if (!command) {
    return
  }
  // Why only on entering the column: a status update fires when the column changes, so a card already in Review never reruns it.
  for (const update of plan.statusUpdates) {
    // Why local only: the command runs on this machine, so another host's workspace path means nothing here.
    if (update.condition !== 'review' || update.executionHostId !== 'local') {
      continue
    }
    const target = targets.find((entry) => entry.worktreeId === update.worktreeId)
    const worktree = useAppStore.getState().getKnownWorktreeById(update.worktreeId)
    if (!target || !worktree) {
      continue
    }
    const result = await window.api.reviewStatusRules
      .runWorkspaceCommand({ worktreePath: worktree.path, command })
      .catch((error: unknown) => ({
        success: false,
        output: error instanceof Error ? error.message : String(error)
      }))
    if (!result.success) {
      toast.error(
        translate(
          'auto.components.workspaceStatusRules.reviewCommandFailed',
          '"{{command}}" failed in {{name}}',
          { command, name: target.displayName }
        ),
        { description: result.output.split('\n').slice(-6).join('\n') }
      )
    }
  }
}
