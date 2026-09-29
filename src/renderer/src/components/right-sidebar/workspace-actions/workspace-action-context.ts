import type { AppState } from '@/store/types'
import { getRepoMapFromState, getWorktreeMapFromState } from '@/store/selectors'
import { getGitHubPRCacheKey } from '@/store/slices/github-cache-key'
import { isGitHubPRSuppressed } from '../../../../../shared/worktree/github-pr-suppression'
import type { PRInfo } from '../../../../../shared/github/pull-request-types'
import type { GitStatusEntry } from '../../../../../shared/git-status-types'
import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import {
  resolveWorkspaceAction,
  type WorkspaceActionKind
} from '../../../../../shared/workspace-action'

export type WorkspaceActionContext = {
  worktree: Worktree
  repo: Repo
  branch: string
  pr: PRInfo | null
  unresolvedConflicts: GitStatusEntry[]
  action: WorkspaceActionKind | null
}

const EMPTY_ENTRIES: GitStatusEntry[] = []

export function selectWorkspaceActionContext(state: AppState): WorkspaceActionContext | null {
  const worktree = state.activeWorktreeId
    ? getWorktreeMapFromState(state).get(state.activeWorktreeId)
    : undefined
  const repo = worktree ? getRepoMapFromState(state).get(worktree.repoId) : undefined
  const branch = worktree?.branch.replace(/^refs\/heads\//, '') ?? ''
  if (!worktree || !repo || !branch) {
    return null
  }
  const cached =
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
    ]?.data ?? null
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
    pullRequest: pr ? { state: pr.state, conflicting: pr.mergeable === 'CONFLICTING' } : null
  })
  return { worktree, repo, branch, pr, unresolvedConflicts, action }
}
