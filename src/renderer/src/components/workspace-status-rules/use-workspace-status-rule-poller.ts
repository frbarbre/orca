import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { installWindowVisibilityTimeoutPoller } from '@/lib/window-visibility-timeout-poller'
import { getIndexedRepoMap } from '@/store/worktree-repo-index'
import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'
import { buildWorkspaceStatusRulePlan } from '../../../../shared/workspace-status-rule-plan'
import { applyWorkspaceStatusRulePlan } from './apply-workspace-status-rule-plan'
import { collectWorkspaceStatusRuleScope } from './collect-workspace-status-rule-targets'

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
  const plan = buildWorkspaceStatusRulePlan({
    targets: scope.targets,
    snapshot,
    config,
    existingBranches: scope.existingBranches
  })
  await applyWorkspaceStatusRulePlan(plan, config)
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
