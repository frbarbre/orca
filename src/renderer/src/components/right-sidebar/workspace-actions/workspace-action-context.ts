import type { AppState } from '@/store/types'
import { getRepoMapFromState, getWorktreeMapFromState } from '@/store/selectors'
import { getGitHubPRCacheKey } from '../../../../../shared/github/github-cache-key'
import { isGitHubPRSuppressed } from '../../../../../shared/worktree/github-pr-suppression'
import type { PRInfo } from '../../../../../shared/github/pull-request-types'
import type { GitStatusEntry } from '../../../../../shared/git-status-types'
import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import {
  resolveWorkspaceAction,
  type WorkspaceActionKind,
  type WorkspaceMergeAction
} from '../../../../../shared/workspace-action'
import { presentGitHubPRMergeState } from '@/components/github-pr-merge-state'

export type WorkspaceActionContext = {
  worktree: Worktree
  repo: Repo
  branch: string
  pr: PRInfo | null
  unresolvedConflicts: GitStatusEntry[]
  action: WorkspaceActionKind | null
}

const EMPTY_ENTRIES: GitStatusEntry[] = []

// Why: the same merge-state reading the PR panel used, so the button offers what GitHub accepts.
// Stacks are left to GitHub, since merging one there also lands every PR below it.
export function resolvePullRequestMergeAction(pr: PRInfo): WorkspaceMergeAction | null {
  if (pr.state !== 'open' || pr.stack) {
    return null
  }
  const presentation = presentGitHubPRMergeState(pr)
  if (presentation.directMergeAvailable) {
    return 'merge'
  }
  if (presentation.autoMergeAction) {
    return presentation.autoMergeAction.kind === 'enable'
      ? 'enable-auto-merge'
      : 'disable-auto-merge'
  }
  return null
}

export function selectWorkspaceActionContext(state: AppState): WorkspaceActionContext | null {
  const worktree = state.activeWorktreeId
    ? getWorktreeMapFromState(state).get(state.activeWorktreeId)
    : undefined
  const repo = worktree ? getRepoMapFromState(state).get(worktree.repoId) : undefined
  const branch = worktree?.branch.replace(/^refs\/heads\//, '') ?? ''
  if (!worktree || !repo || !branch) {
    return null
  }
  const entry =
    state.prCache[
      getGitHubPRCacheKey(
        repo.path,
        repo.id,
        branch,
        state.settings,
        repo.connectionId,
        repo.executionHostId,
        true
      )
    ]
  const cached = entry?.data ?? null
  const pr = cached && !isGitHubPRSuppressed(worktree, cached.number) ? cached : null
  const entries = state.gitStatusByWorktree[worktree.id] ?? EMPTY_ENTRIES
  const unresolvedConflicts = entries.filter(
    (entry) => entry.conflictStatus === 'unresolved' && entry.conflictKind
  )
  const upstream = state.remoteStatusesByWorktree[worktree.id]
  const action = resolveWorkspaceAction({
    hasUncommittedChanges: entries.length > unresolvedConflicts.length,
    hasUpstream: upstream?.hasUpstream === true,
    unpushedCommits: upstream?.hasUpstream ? upstream.ahead : 0,
    hasLocalConflicts: unresolvedConflicts.length > 0,
    isDefaultBranch: worktree.isMainWorktree || branch === 'main' || branch === 'master',
    pullRequest: pr
      ? {
          state: pr.state,
          conflicting: pr.mergeable === 'CONFLICTING',
          mergeAction: resolvePullRequestMergeAction(pr),
          headIsLocal:
            pr.headSha !== undefined && state.gitStatusHeadByWorktree[worktree.id] === pr.headSha
        }
      : null,
    pullRequestKnown: entry !== undefined && !entry.error
  })
  return { worktree, repo, branch, pr, unresolvedConflicts, action }
}
