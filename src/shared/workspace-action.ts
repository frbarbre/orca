import type { PRState } from './github/pull-request-types'

export type WorkspaceMergeAction = 'merge' | 'enable-auto-merge' | 'disable-auto-merge'

export type WorkspaceActionKind =
  | 'commit-and-push'
  | 'resolve-conflicts'
  | 'ready-for-review'
  | 'create-pull-request'
  | WorkspaceMergeAction

export type WorkspaceActionInput = {
  hasUncommittedChanges: boolean
  hasUpstream: boolean
  unpushedCommits: number
  hasLocalConflicts: boolean
  isDefaultBranch: boolean
  pullRequest: {
    state: PRState
    conflicting: boolean
    /** What GitHub allows for an open pull request: merge now, or wait through auto-merge. */
    mergeAction?: WorkspaceMergeAction | null
    /** The pull request's head is the commit checked out here, so nothing is left to push. */
    headIsLocal?: boolean
  } | null
  // Why: an unanswered lookup is not "no pull request", and must not offer Create PR.
  pullRequestKnown: boolean
}

// Why this order: a merge stopped on conflicts cannot be committed, so it outranks everything. A
// branch with no pull request goes straight to Create PR, whose prompt commits and pushes the work
// too. Otherwise unfinished local work comes first, then what blocks the pull request, then its
// next step.
export function resolveWorkspaceAction(input: WorkspaceActionInput): WorkspaceActionKind | null {
  if (input.hasLocalConflicts) {
    return 'resolve-conflicts'
  }
  const pr = input.pullRequest
  if (!pr && input.pullRequestKnown && !input.isDefaultBranch) {
    return 'create-pull-request'
  }
  if (input.hasUncommittedChanges || (input.hasUpstream && input.unpushedCommits > 0)) {
    return 'commit-and-push'
  }
  if (pr && (pr.state === 'open' || pr.state === 'draft')) {
    if (pr.conflicting) {
      return 'resolve-conflicts'
    }
    if (pr.state === 'draft') {
      return 'ready-for-review'
    }
    // Why: merging ships what the pull request holds, so it waits until that is the local work.
    return pr.headIsLocal ? (pr.mergeAction ?? null) : null
  }
  return null
}
