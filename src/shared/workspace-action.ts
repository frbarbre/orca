import type { PRState } from './github/pull-request-types'

export type WorkspaceActionKind =
  | 'commit-and-push'
  | 'resolve-conflicts'
  | 'ready-for-review'
  | 'create-pull-request'

export type WorkspaceActionInput = {
  hasUncommittedChanges: boolean
  hasUpstream: boolean
  unpushedCommits: number
  hasLocalConflicts: boolean
  isDefaultBranch: boolean
  pullRequest: { state: PRState; conflicting: boolean } | null
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
    return pr.state === 'draft' ? 'ready-for-review' : null
  }
  return null
}
