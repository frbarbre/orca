import type { AppState } from '@/store/types'
import { getGitHubPRCacheKey } from '@/store/slices/github-cache-key'
import { getIndexedAllWorktrees, getIndexedRepoMap } from '@/store/worktree-repo-index'
import { resolveWorktreeBranchLabel } from '@/lib/worktree-default-display-name'
import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'
import type { WorkspaceStatusRuleTarget } from '../../../../shared/workspace-status-rule-plan'

export type WorkspaceStatusRuleScope = {
  targets: WorkspaceStatusRuleTarget[]
  linkedPullRequests: { repo: GitHubRepositoryIdentity; number: number }[]
  existingBranches: Set<string>
  /** Working directory for the `gh` call; snapshot queries name their own repos. */
  repoPath: string | null
}

export function collectWorkspaceStatusRuleScope(
  state: AppState,
  repoIds: readonly string[]
): WorkspaceStatusRuleScope {
  const scope: WorkspaceStatusRuleScope = {
    targets: [],
    linkedPullRequests: [],
    existingBranches: new Set(),
    repoPath: null
  }
  const scopedRepoIds = new Set(repoIds)
  const repoMap = getIndexedRepoMap(state.repos)
  // Why a local checkout is preferred: `gh` runs with this as its working
  // directory, and a remote project's path does not exist on this machine.
  const scopedRepos = repoIds.flatMap((id) => repoMap.get(id) ?? [])
  scope.repoPath = (scopedRepos.find((repo) => !repo.connectionId) ?? scopedRepos[0])?.path ?? null
  for (const worktree of getIndexedAllWorktrees(state.worktreesByRepo)) {
    if (!scopedRepoIds.has(worktree.repoId)) {
      continue
    }
    const branch = resolveWorktreeBranchLabel(worktree)
    if (branch) {
      scope.existingBranches.add(branch)
    }
    if (worktree.isArchived || worktree.isBare || worktree.isMainWorktree || !branch) {
      continue
    }
    const repo = repoMap.get(worktree.repoId)
    if (!repo) {
      continue
    }
    const pr =
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
      ]?.data
    if (!pr?.prRepo) {
      continue
    }
    scope.targets.push({
      worktreeId: worktree.id,
      executionHostId: worktree.hostId ?? 'local',
      displayName: worktree.displayName,
      repo: pr.prRepo,
      prNumber: pr.number,
      currentStatus: worktree.workspaceStatus ?? null
    })
    scope.linkedPullRequests.push({ repo: pr.prRepo, number: pr.number })
  }
  return scope
}
