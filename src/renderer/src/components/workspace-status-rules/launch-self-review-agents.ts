import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { translate } from '@/i18n/i18n'
import type { ReviewStatusSnapshot } from '../../../../shared/github/review-status-snapshot-types'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type {
  WorkspaceStatusRulePlan,
  WorkspaceStatusRuleTarget
} from '../../../../shared/workspace-status-rule-plan'
import {
  buildReviewPromptVariables,
  renderWorkspaceStatusRulePrompt
} from '../../../../shared/workspace-status-rule-prompt'
import { applyReviewAgentView } from './apply-review-agent-view'
import { openReviewWorkspaceLayout } from './open-review-workspace-layout'

// Fork: your own pull request entering Self review gets the review inbox's first look, in place.
export async function launchSelfReviewAgents(
  plan: WorkspaceStatusRulePlan,
  targets: readonly WorkspaceStatusRuleTarget[],
  snapshot: Pick<ReviewStatusSnapshot, 'linkedPullRequests'>,
  config: WorkspaceStatusRuleConfig
): Promise<void> {
  // Why only on entering the column: a status update fires when the column changes, so a card already in Self review never relaunches.
  for (const update of plan.statusUpdates) {
    if (update.condition !== 'self-review') {
      continue
    }
    const target = targets.find((entry) => entry.worktreeId === update.worktreeId)
    const pr = target
      ? snapshot.linkedPullRequests.find(
          (entry) =>
            entry.number === target.prNumber &&
            entry.repo.owner.toLowerCase() === target.repo.owner.toLowerCase() &&
            entry.repo.repo.toLowerCase() === target.repo.repo.toLowerCase()
        )
      : undefined
    const worktree = useAppStore.getState().getKnownWorktreeById(update.worktreeId)
    if (!target || !pr || !worktree) {
      continue
    }
    try {
      const launched = await launchAgentBackgroundSession({
        agent: config.reviewInbox.agent,
        worktreeId: worktree.id,
        prompt: renderWorkspaceStatusRulePrompt(
          config.reviewInbox.promptTemplate,
          buildReviewPromptVariables(pr)
        ),
        launchSource: 'unknown',
        title: translate(
          'auto.components.workspaceStatusRules.selfReviewTabTitle',
          'Self review #{{number}}',
          { number: pr.number }
        )
      })
      if (!launched?.tabId) {
        continue
      }
      applyReviewAgentView(launched, config.reviewInbox.view)
      void openReviewWorkspaceLayout({
        worktreeId: worktree.id,
        worktreePath: worktree.path,
        agentTabId: launched.tabId,
        baseRef: `origin/${pr.baseRefName}`,
        prUrl: pr.url
      })
    } catch (error) {
      toast.error(
        translate(
          'auto.components.workspaceStatusRules.selfReviewAgentFailed',
          'Could not start a self review in {{name}}: {{reason}}',
          {
            name: target.displayName,
            reason: error instanceof Error ? error.message : String(error)
          }
        )
      )
    }
  }
}
