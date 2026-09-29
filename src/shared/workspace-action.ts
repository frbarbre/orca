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
}

// Why this order: unfinished local work comes first, then what blocks the pull request, then the
// next step in its life. A merge stopped on conflicts cannot be committed, so it outranks everything.
export function resolveWorkspaceAction(input: WorkspaceActionInput): WorkspaceActionKind | null {
  if (input.hasLocalConflicts) {
    return 'resolve-conflicts'
  }
  if (input.hasUncommittedChanges || (input.hasUpstream && input.unpushedCommits > 0)) {
    return 'commit-and-push'
  }
  const pr = input.pullRequest
  if (pr && (pr.state === 'open' || pr.state === 'draft')) {
    if (pr.conflicting) {
      return 'resolve-conflicts'
    }
    return pr.state === 'draft' ? 'ready-for-review' : null
  }
  if (pr || input.isDefaultBranch) {
    return null
  }
  return 'create-pull-request'
}
