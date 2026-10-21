import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { presentGitHubPRMergeState } from '@/components/github-pr-merge-state'
import type { PRInfo } from '../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../shared/repo-types'
import { resolveGitHubPRMergeMethods } from '../../../../shared/github/pull-request-merge-methods'
import { presentGitLabMRMergeState } from './gitlab-mr-merge-state'
import { useHostedReviewActions, type HostedReviewActionInfo } from './use-hosted-review-actions'
import { translate } from '@/i18n/i18n'
import {
  getGitHubPRStackMergeBlocker,
  getGitHubPRStackMergeScope,
  isGitHubPRStackMergeQueueRequired
} from './github-pr-stack-merge'

/** What a single merge button does for an open review: merge it, or turn auto-merge on or off. */
export type HostedReviewPrimaryMerge = {
  kind: 'merge' | 'auto_merge'
  label: string
  tooltip: string
  disabled: boolean
  run: () => void
}

/**
 * Fork: what Source Control's primary button does for the branch's open review — the merge the
 * PR panel used to offer — refused while the workspace has uncommitted changes.
 */
export function useHostedReviewMergeControls({
  review,
  githubPR,
  repo,
  worktreeId,
  onRefreshReview
}: {
  review: HostedReviewActionInfo
  githubPR?: PRInfo | null
  repo: Repo
  worktreeId: string | null
  onRefreshReview: () => Promise<void>
}) {
  const isGitLab = review.provider === 'gitlab'
  const shortLabel = isGitLab ? 'MR' : 'PR'
  const reviewLabel = isGitLab ? 'merge request' : 'pull request'
  const uncommittedChanges = useAppStore((state) =>
    worktreeId ? (state.gitStatusByWorktree[worktreeId]?.length ?? 0) : 0
  )
  const stackMergeScope = useMemo(
    () => (githubPR?.stack ? getGitHubPRStackMergeScope(githubPR.stack, review.number) : null),
    [githubPR?.stack, review.number]
  )
  const stackUsesMergeQueue = isGitHubPRStackMergeQueueRequired(
    review.mergeQueueRequired,
    githubPR?.mergeQueueRequired
  )
  const stackMergeLabel =
    stackMergeScope && stackUsesMergeQueue
      ? stackMergeScope.count === 1
        ? translate(
            'auto.components.right.sidebar.HostedReviewActions.9a41a687b7',
            'Queue through #{{pr}} · {{count}} PR',
            { pr: review.number, count: stackMergeScope.count }
          )
        : translate(
            'auto.components.right.sidebar.HostedReviewActions.38a1bccb14',
            'Queue through #{{pr}} · {{count}} PRs',
            { pr: review.number, count: stackMergeScope.count }
          )
      : stackMergeScope?.label
  const mergePresentation = useMemo(() => {
    if (isGitLab) {
      return { ...presentGitLabMRMergeState(review), autoMergeAction: null }
    }
    const presentation = presentGitHubPRMergeState({
      ...githubPR,
      state: review.state,
      mergeable: review.mergeable,
      mergeStateStatus: review.mergeStateStatus,
      reviewDecision: review.reviewDecision,
      checksStatus: review.status,
      autoMergeEnabled: review.autoMergeEnabled,
      autoMergeAllowed: review.autoMergeAllowed,
      mergeQueueRequired: review.mergeQueueRequired
    })
    if (!githubPR?.stack || !stackMergeScope) {
      return presentation
    }
    const stackBlocker = getGitHubPRStackMergeBlocker(stackMergeScope)
    return {
      ...presentation,
      label: stackMergeLabel ?? stackMergeScope.label,
      tooltip:
        stackBlocker ??
        (stackUsesMergeQueue
          ? translate(
              'auto.components.right.sidebar.HostedReviewActions.3de88351c5',
              'GitHub will add this pull request and every pull request below it to the merge queue.'
            )
          : translate(
              'auto.components.right.sidebar.HostedReviewActions.a32fe6dba6',
              'GitHub will merge this pull request and every pull request below it in the stack.'
            )),
      directMergeAvailable:
        !stackBlocker &&
        (stackMergeScope.complete || presentation.directMergeAvailable || stackUsesMergeQueue),
      autoMergeAction: null
    }
  }, [githubPR, isGitLab, review, stackMergeLabel, stackMergeScope, stackUsesMergeQueue])
  const mergeMethods = useMemo(
    () => resolveGitHubPRMergeMethods(isGitLab ? null : (githubPR?.mergeMethodSettings ?? null)),
    [githubPR?.mergeMethodSettings, isGitLab]
  )
  const { merging, stateUpdating, handleAutoMerge, handleMerge } = useHostedReviewActions({
    review,
    githubPR,
    repo,
    isGitLab,
    shortLabel,
    reviewLabel,
    defaultMergeMethod: mergeMethods.defaultMethod,
    autoMergeAction: mergePresentation.autoMergeAction,
    onRefreshReview
  })
  // Why: merging ships what the PR holds, so work left uncommitted here would be silently left out.
  const uncommittedBlocker =
    uncommittedChanges > 0
      ? translate(
          'auto.components.right.sidebar.HostedReviewActions.mergeUncommitted',
          'Commit your changes before merging ({{files}} uncommitted)',
          { files: String(uncommittedChanges) }
        )
      : null
  const isUpdatingReviewState = stateUpdating !== null
  const primaryMergeDisabled =
    merging ||
    isUpdatingReviewState ||
    uncommittedBlocker !== null ||
    (!mergePresentation.directMergeAvailable && !mergePresentation.autoMergeAction)
  const usesAutoMerge =
    mergePresentation.autoMergeAction !== null && !mergePresentation.directMergeAvailable
  const primaryMerge: HostedReviewPrimaryMerge | null =
    review.state === 'open'
      ? {
          kind: usesAutoMerge ? 'auto_merge' : 'merge',
          label: mergePresentation.directMergeAvailable
            ? (stackMergeLabel ?? mergeMethods.defaultLabel)
            : (mergePresentation.autoMergeAction?.label ?? mergePresentation.label),
          tooltip: uncommittedBlocker ?? mergePresentation.tooltip,
          disabled: primaryMergeDisabled,
          run: () =>
            usesAutoMerge ? void handleAutoMerge() : void handleMerge(mergeMethods.defaultMethod)
        }
      : null
  return { primaryMerge }
}
