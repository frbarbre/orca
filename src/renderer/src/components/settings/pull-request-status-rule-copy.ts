import { translate } from '@/i18n/i18n'
import type { WorkspaceStatusRuleCondition } from '../../../../shared/workspace-status-rule-config'

export type PullRequestStatusRuleCopy = {
  label: string
  description: string
}

/** Listed in evaluation order; the first condition a pull request satisfies wins. */
export function getPullRequestStatusRuleCopy(): Record<
  WorkspaceStatusRuleCondition,
  PullRequestStatusRuleCopy
> {
  return {
    merged: {
      label: translate('auto.components.settings.prRules.merged', 'Pull request is merged'),
      description: translate(
        'auto.components.settings.prRules.mergedDescription',
        'Already landed on the base branch. Only used when the workspace is kept — deleting on merge takes precedence.'
      )
    },
    closed: {
      label: translate('auto.components.settings.prRules.closed', 'Pull request was closed'),
      description: translate(
        'auto.components.settings.prRules.closedDescription',
        'Closed without merging. Only used when the workspace is kept.'
      )
    },
    reviewing: {
      label: translate('auto.components.settings.prRules.reviewing', 'You are the reviewer'),
      description: translate(
        'auto.components.settings.prRules.reviewingDescription',
        'Somebody else opened the pull request. Stays here until it merges.'
      )
    },
    draft: {
      label: translate('auto.components.settings.prRules.draft', 'Pull request is a draft'),
      description: translate(
        'auto.components.settings.prRules.draftDescription',
        'Also applies when a ready pull request is put back into draft.'
      )
    },
    'changes-requested': {
      label: translate('auto.components.settings.prRules.changes', 'Changes requested'),
      description: translate(
        'auto.components.settings.prRules.changesDescription',
        'Clears as soon as you re-request review from that reviewer.'
      )
    },
    merging: {
      label: translate('auto.components.settings.prRules.merging', 'Merge gate passed'),
      description: translate(
        'auto.components.settings.prRules.mergingDescription',
        'The check named below succeeded on the head commit. The pull request is open, not merged.'
      )
    },
    'pm-approval': {
      label: translate('auto.components.settings.prRules.pmApproval', 'Waiting on PM approval'),
      description: translate(
        'auto.components.settings.prRules.pmApprovalDescription',
        'Every reviewer still to respond belongs to the team below.'
      )
    },
    review: {
      label: translate('auto.components.settings.prRules.review', 'Ready for review'),
      description: translate(
        'auto.components.settings.prRules.reviewDescription',
        'Open, not a draft, and none of the conditions above apply.'
      )
    }
  }
}
