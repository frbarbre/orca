import type { AppState } from '@/store/types'
import { getGitHubPRCacheKey } from '@/store/slices/github-cache-key'
import { getIndexedAllWorktrees, getIndexedRepoMap } from '@/store/worktree-repo-index'
import { resolveWorktreeBranchLabel } from '@/lib/worktree-default-display-name'
import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'
import type { WorkspaceStatusRuleTarget } from '../../../../shared/workspace-status-rule-plan'
import type { NewWorkspaceStatusTarget } from '../../../../shared/workspace-new-status-plan'
import { getPendingReviewDrafts } from '../pending-review/pending-review-draft-store'
import type { ReviewHeadSyncCandidate } from '../../../../shared/github/review-head-sync'

export type WorkspaceStatusRuleScope = {
  targets: WorkspaceStatusRuleTarget[]
  linkedPullRequests: { repo: GitHubRepositoryIdentity; number: number }[]
  existingBranches: Set<string>
  /** Working directory for the `gh` call; snapshot queries name their own repos. */
  repoPath: string | null
}

/** Workspaces in the scoped projects that no rule or person has given a column yet. */
export function collectNewWorkspaceStatusTargets(
  state: AppState,
  repoIds: readonly string[]
): NewWorkspaceStatusTarget[] {
  const scopedRepoIds = new Set(repoIds)
  return getIndexedAllWorktrees(state.worktreesByRepo).flatMap((worktree) =>
    scopedRepoIds.has(worktree.repoId) &&
    !worktree.isArchived &&
    !worktree.isBare &&
    !worktree.isMainWorktree &&
    !worktree.workspaceStatus
      ? [
          {
            worktreeId: worktree.id,
            executionHostId: worktree.hostId ?? 'local',
            currentStatus: null,
            createdAt: worktree.createdAt ?? null
          }
        ]
      : []
  )
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
      currentStatus: worktree.workspaceStatus ?? null,
      headOid: worktree.head,
      // Why both: a queue not yet moved onto this device still sits on the workspace metadata.
      hasPendingReviewComments:
        (getPendingReviewDrafts(worktree.id)?.length ?? 0) > 0 ||
        (worktree.pendingReviewComments?.length ?? 0) > 0
    })
    scope.linkedPullRequests.push({ repo: pr.prRepo, number: pr.number })
  }
  return scope
}

export function collectReviewHeadSyncCandidates(
  state: AppState,
  targets: readonly WorkspaceStatusRuleTarget[]
): ReviewHeadSyncCandidate[] {
  const worktrees = new Map(
    getIndexedAllWorktrees(state.worktreesByRepo).map((worktree) => [worktree.id, worktree])
  )
  const repoMap = getIndexedRepoMap(state.repos)
  return targets.flatMap((target) => {
    const worktree = worktrees.get(target.worktreeId)
    const branch = worktree ? resolveWorktreeBranchLabel(worktree) : null
    if (!worktree || !branch) {
      return []
    }
    const repo = repoMap.get(worktree.repoId)
    return [
      {
        worktreeId: worktree.id,
        worktreePath: worktree.path,
        branch,
        localHead: worktree.head,
        isLocal: !repo?.connectionId && (worktree.hostId ?? 'local') === 'local',
        repo: target.repo,
        prNumber: target.prNumber
      }
    ]
  })
}
