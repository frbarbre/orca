import type { PRState } from '../../../../../../shared/github/pull-request-types'
import type { PrimaryAction } from '../../source-control-primary-action'
import type { HostedReviewPrimaryMerge } from '../../use-hosted-review-merge-controls'

/**
 * Fork: once a branch with an open PR has nothing left to commit and the PR's head is the commit
 * checked out here, the primary button merges the PR (or toggles auto-merge).
 */
export function resolveReviewMergePrimaryAction(
  primaryAction: PrimaryAction,
  inputs: {
    stagedCount: number
    hasUnstagedChanges: boolean
    hasUnresolvedConflicts: boolean
    isCommitting: boolean
    isRemoteOperationActive: boolean
    localHeadSha: string | null
    reviewHeadSha: string | undefined
    prState: PRState | null | undefined
    reviewMerge: Pick<HostedReviewPrimaryMerge, 'kind' | 'label' | 'tooltip' | 'disabled'> | null
  }
): PrimaryAction {
  const { reviewMerge } = inputs
  // Why: a PR-linked workspace often has no usable upstream to compare against, so "everything is
  // pushed" is read off the PR itself: its head is exactly the commit checked out here.
  const settled =
    inputs.stagedCount === 0 &&
    !inputs.hasUnstagedChanges &&
    !inputs.hasUnresolvedConflicts &&
    !inputs.isCommitting &&
    !inputs.isRemoteOperationActive &&
    inputs.localHeadSha !== null &&
    inputs.localHeadSha === inputs.reviewHeadSha
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
