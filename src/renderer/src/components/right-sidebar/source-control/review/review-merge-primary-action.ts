import type { GitUpstreamStatus } from '../../../../../../shared/git-status-types'
import type { PRState } from '../../../../../../shared/github/pull-request-types'
import type { PrimaryAction } from '../../source-control-primary-action'
import type { HostedReviewPrimaryMerge } from '../../use-hosted-review-merge-controls'

/**
 * Fork: once a branch with an open PR has nothing left to commit, push or pull, the primary
 * button merges the PR (or toggles auto-merge) the way the PR panel's merge button does.
 */
export function resolveReviewMergePrimaryAction(
  primaryAction: PrimaryAction,
  inputs: {
    stagedCount: number
    hasUnstagedChanges: boolean
    hasUnresolvedConflicts: boolean
    isCommitting: boolean
    isRemoteOperationActive: boolean
    upstreamStatus: GitUpstreamStatus | undefined
    prState: PRState | null | undefined
    reviewMerge: Pick<HostedReviewPrimaryMerge, 'kind' | 'label' | 'tooltip' | 'disabled'> | null
  }
): PrimaryAction {
  const { upstreamStatus, reviewMerge } = inputs
  const settled =
    inputs.stagedCount === 0 &&
    !inputs.hasUnstagedChanges &&
    !inputs.hasUnresolvedConflicts &&
    !inputs.isCommitting &&
    !inputs.isRemoteOperationActive &&
    upstreamStatus?.hasUpstream === true &&
    upstreamStatus.ahead === 0 &&
    upstreamStatus.behind === 0
  if (!settled || inputs.prState !== 'open' || !reviewMerge) {
    return primaryAction
  }
  return {
    kind: reviewMerge.kind,
    label: reviewMerge.label,
    title: reviewMerge.tooltip,
    disabled: reviewMerge.disabled
  }
}
