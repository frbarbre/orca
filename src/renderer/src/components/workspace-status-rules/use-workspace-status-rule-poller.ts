import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { installWindowVisibilityTimeoutPoller } from '@/lib/window-visibility-timeout-poller'
import { getIndexedRepoMap } from '@/store/worktree-repo-index'
import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'
import { buildWorkspaceStatusRulePlan } from '../../../../shared/workspace-status-rule-plan'
import { applyWorkspaceStatusRulePlan } from './apply-workspace-status-rule-plan'
import {
  collectNewWorkspaceStatusTargets,
  collectReviewHeadSyncCandidates,
  collectWorkspaceStatusRuleScope
} from './collect-workspace-status-rule-targets'
import { planReviewHeadSyncs } from '../../../../shared/github/review-head-sync'
import { setPullRequestAuthors } from './pr-author-store'
import { launchConflictAgents } from './launch-conflict-agents'
import { planNewWorkspaceStatusUpdates } from '../../../../shared/workspace-new-status-plan'
import { loadPendingReviewDrafts } from '../pending-review/pending-review-draft-store'

/** Matches the active-workspace review tier; a board does not change faster than this. */
const POLL_INTERVAL_MS = 60_000

const slugCache = new Map<string, GitHubRepositoryIdentity>()

async function resolveScopedRepoSlugs(
  repoIds: readonly string[]
): Promise<GitHubRepositoryIdentity[]> {
  const repoMap = getIndexedRepoMap(useAppStore.getState().repos)
  const slugs: GitHubRepositoryIdentity[] = []
  for (const repoId of repoIds) {
    const repo = repoMap.get(repoId)
    if (!repo) {
      continue
    }
    // Why a failure is not cached: a lookup that fails once (offline, gh not yet
    // authenticated) would otherwise disable the review inbox until a restart.
    const slug =
      slugCache.get(repoId) ??
      (await window.api.gh.repoSlug({ repoPath: repo.path, repoId }).catch(() => null))
    if (slug) {
      slugCache.set(repoId, slug)
      slugs.push(slug)
    }
  }
  return slugs
}

async function runWorkspaceStatusRuleTick(): Promise<void> {
  const state = useAppStore.getState()
  const config = state.workspaceStatusRules
  if (!config.enabled || config.repoIds.length === 0) {
    return
  }
  await Promise.all(
    planNewWorkspaceStatusUpdates(
      collectNewWorkspaceStatusTargets(state, config.repoIds),
      config.newWorkspaceStatus,
      config.newWorkspaceStatusSince
    ).map((update) =>
      state.updateWorktreeMeta(
        update.worktreeId,
        { workspaceStatus: update.status },
        { executionHostId: update.executionHostId }
      )
    )
  )
  // Why awaited: the reviewed-removal guard reads the queue, and one still loading would read as
  // empty and let a workspace with unsent comments be deleted.
  await loadPendingReviewDrafts()
  const scope = collectWorkspaceStatusRuleScope(state, config.repoIds)
  if (!scope.repoPath) {
    return
  }
  const snapshot = await window.api.reviewStatusRules.snapshot({
    repoPath: scope.repoPath,
    linkedPullRequests: scope.linkedPullRequests,
    includeReviewInbox: config.reviewInbox.enabled,
    reviewInboxRepos: config.reviewInbox.enabled
      ? await resolveScopedRepoSlugs(config.repoIds)
      : [],
    pmApprovalTeam: config.pmApprovalTeam
  })
  setPullRequestAuthors(
    new Map(
      scope.targets.flatMap((target) => {
        const author = snapshot.linkedPullRequests.find(
          (pr) =>
            pr.number === target.prNumber &&
            pr.repo.owner.toLowerCase() === target.repo.owner.toLowerCase() &&
            pr.repo.repo.toLowerCase() === target.repo.repo.toLowerCase()
        )?.author
        return author ? [[target.worktreeId, author] as const] : []
      })
    )
  )
  const plan = buildWorkspaceStatusRulePlan({
    targets: scope.targets,
    snapshot,
    config,
    existingBranches: scope.existingBranches
  })
  await applyWorkspaceStatusRulePlan(plan, config)
  await launchConflictAgents(plan, scope.targets, snapshot, config)
  await syncReviewWorkspaceHeads(scope.targets, snapshot)
}

async function syncReviewWorkspaceHeads(
  targets: Parameters<typeof collectReviewHeadSyncCandidates>[1],
  snapshot: Parameters<typeof planReviewHeadSyncs>[1]
): Promise<void> {
  const syncs = planReviewHeadSyncs(
    collectReviewHeadSyncCandidates(useAppStore.getState(), targets),
    snapshot
  )
  // Why one at a time: each is a fetch and a reset in a different checkout of the same repository.
  for (const { worktreeId, ...request } of syncs) {
    const result = await window.api.reviewStatusRules
      .syncReviewHead(request)
      .catch((error: unknown) => {
        console.warn('[workspace-status-rules] review head sync failed:', worktreeId, error)
        return null
      })
    if (result?.kind === 'skipped') {
      console.info(
        '[workspace-status-rules] kept review workspace as is:',
        worktreeId,
        result.reason
      )
    }
  }
}

export function useWorkspaceStatusRulePoller(): void {
  const enabled = useAppStore((state) => state.workspaceStatusRules.enabled)

  useEffect(() => {
    if (!enabled) {
      return
    }
    return installWindowVisibilityTimeoutPoller({
      run: () =>
        runWorkspaceStatusRuleTick().catch((error) => {
          console.warn('[workspace-status-rules] tick failed:', error)
        }),
      getDelayMs: () => POLL_INTERVAL_MS
    })
  }, [enabled])
}
