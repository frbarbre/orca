import type { GitHubPRStackEntry } from '../../../../shared/github/pull-request-types'
import { translate } from '@/i18n/i18n'

export type GitHubPRStackEntryTone = 'ready' | 'pending' | 'blocked' | 'merged' | 'neutral'

export type GitHubPRStackEntryStatus = { label: string; tone: GitHubPRStackEntryTone }

const READY_MERGE_STATES = new Set(['CLEAN', 'HAS_HOOKS', 'UNSTABLE'])

// Readiness follows GitHub's merge state, which only weighs required checks; the rollup counts every check.
export function getGitHubPRStackEntryStatus(entry: GitHubPRStackEntry): GitHubPRStackEntryStatus {
  if (entry.state === 'merged') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.8a9bdc36c0', 'Merged'),
      tone: 'merged'
    }
  }
  if (entry.state === 'closed') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.3511405914', 'Closed'),
      tone: 'neutral'
    }
  }
  if (entry.state === 'draft') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.568c647ccd', 'Draft'),
      tone: 'neutral'
    }
  }
  if (entry.mergeStateStatus && READY_MERGE_STATES.has(entry.mergeStateStatus)) {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.ready', 'Ready'),
      tone: 'ready'
    }
  }
  if (entry.mergeable === 'CONFLICTING' || entry.mergeStateStatus === 'DIRTY') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.bea9ade223', 'Conflicts'),
      tone: 'blocked'
    }
  }
  if (entry.checksStatus === 'failure') {
    return {
      label: translate(
        'auto.components.right.sidebar.GitHubPRStackMap.838aadf512',
        'Checks failed'
      ),
      tone: 'blocked'
    }
  }
  if (entry.reviewDecision === 'CHANGES_REQUESTED') {
    return {
      label: translate(
        'auto.components.right.sidebar.GitHubPRStackMap.4b1e5ee9d3',
        'Changes requested'
      ),
      tone: 'blocked'
    }
  }
  if (entry.reviewDecision === 'REVIEW_REQUIRED') {
    return {
      label: translate(
        'auto.components.right.sidebar.GitHubPRStackMap.9a17b5255c',
        'Review needed'
      ),
      tone: 'pending'
    }
  }
  if (entry.checksStatus === 'pending') {
    return {
      label: translate(
        'auto.components.right.sidebar.GitHubPRStackMap.316039b5db',
        'Checks pending'
      ),
      tone: 'pending'
    }
  }
  if (entry.mergeStateStatus === 'BEHIND') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.behind', 'Behind'),
      tone: 'pending'
    }
  }
  if (entry.mergeStateStatus === 'BLOCKED') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.notReady', 'Not ready'),
      tone: 'pending'
    }
  }
  if (entry.reviewDecision === 'APPROVED') {
    return {
      label: translate('auto.components.right.sidebar.GitHubPRStackMap.d3d97cf3f2', 'Approved'),
      tone: 'ready'
    }
  }
  return {
    label: translate('auto.components.right.sidebar.GitHubPRStackMap.e6cb964305', 'Open'),
    tone: 'neutral'
  }
}
