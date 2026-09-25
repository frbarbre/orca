import type { ExecutionHostId } from './execution-host'
import type { GitHubRepositoryIdentity } from './github/pull-request-types'
import type {
  ReviewSnapshotPullRequest,
  ReviewStatusSnapshot
} from './github/review-status-snapshot-types'
import {
  makeHandledPullRequestKey,
  type WorkspaceStatusRuleCondition,
  type WorkspaceStatusRuleConfig
} from './workspace-status-rule-config'
import { lowercaseLoginSet, resolveWorkspaceStatusRule } from './workspace-status-rules'
import type { WorkspaceStatus } from './worktree/types'

/** The inbox search returns at most one page, so this is the real ceiling on a
 *  single tick. Creations run one after another, never concurrently. */
export const MAX_REVIEW_INBOX_CREATES_PER_TICK = 30

/** A workspace with a resolved pull request, flattened so planning stays pure. */
export type WorkspaceStatusRuleTarget = {
  worktreeId: string
  executionHostId: ExecutionHostId
  displayName: string
  repo: GitHubRepositoryIdentity
  prNumber: number
  currentStatus: WorkspaceStatus | null
}

export type WorkspaceStatusRulePlan = {
  statusUpdates: {
    worktreeId: string
    executionHostId: ExecutionHostId
    status: WorkspaceStatus
    condition: WorkspaceStatusRuleCondition
  }[]
  /** Attempted with force off, so Git refuses one holding uncommitted work or a live agent. */
  removals: { worktreeId: string; executionHostId: ExecutionHostId; displayName: string }[]
  creations: { pr: ReviewSnapshotPullRequest; handledKey: string }[]
}

function emptyPlan(): WorkspaceStatusRulePlan {
  return {
    statusUpdates: [],
    removals: [],
    creations: []
  }
}

function snapshotKey(repo: GitHubRepositoryIdentity, number: number): string {
  return `${repo.owner.toLowerCase()}/${repo.repo.toLowerCase()}#${number}`
}

function indexSnapshotPRs(
  pullRequests: readonly ReviewSnapshotPullRequest[]
): Map<string, ReviewSnapshotPullRequest> {
  return new Map(pullRequests.map((pr) => [snapshotKey(pr.repo, pr.number), pr]))
}

export function buildWorkspaceStatusRulePlan(args: {
  targets: readonly WorkspaceStatusRuleTarget[]
  snapshot: ReviewStatusSnapshot
  config: WorkspaceStatusRuleConfig
  /** Head branch names that already have a workspace, so the inbox never duplicates one. */
  existingBranches: ReadonlySet<string>
  maxCreations?: number
}): WorkspaceStatusRulePlan {
  const { targets, snapshot, config, existingBranches } = args
  if (!config.enabled) {
    return emptyPlan()
  }
  const plan = emptyPlan()
  const pmTeamLogins = lowercaseLoginSet(snapshot.pmApprovalTeamLogins)
  const byKey = indexSnapshotPRs(snapshot.linkedPullRequests)

  for (const target of targets) {
    const pr = byKey.get(snapshotKey(target.repo, target.prNumber))
    if (!pr) {
      continue
    }
    const { condition, status } = resolveWorkspaceStatusRule(
      pr,
      config,
      pmTeamLogins,
      snapshot.viewerLogin
    )
    const isResolved = condition === 'merged' || condition === 'closed'
    if (isResolved && config.onResolved === 'delete') {
      plan.removals.push({
        worktreeId: target.worktreeId,
        executionHostId: target.executionHostId,
        displayName: target.displayName
      })
      continue
    }
    if (condition && status && status !== target.currentStatus) {
      plan.statusUpdates.push({
        worktreeId: target.worktreeId,
        executionHostId: target.executionHostId,
        status,
        condition
      })
    }
  }

  if (!config.reviewInbox.enabled) {
    return plan
  }
  const handled = new Set(config.handledPullRequests)
  const viewer = snapshot.viewerLogin?.toLowerCase() ?? null
  const linkedKeys = new Set(targets.map((target) => snapshotKey(target.repo, target.prNumber)))
  const maxCreations = args.maxCreations ?? MAX_REVIEW_INBOX_CREATES_PER_TICK

  for (const pr of snapshot.reviewRequestedPullRequests) {
    const handledKey = makeHandledPullRequestKey(pr.repo, pr.number)
    if (handled.has(handledKey) || linkedKeys.has(snapshotKey(pr.repo, pr.number))) {
      continue
    }
    if (viewer && pr.author?.toLowerCase() === viewer) {
      continue
    }
    if (existingBranches.has(pr.headRefName)) {
      continue
    }
    if (plan.creations.length < maxCreations) {
      plan.creations.push({ pr, handledKey })
    }
  }
  return plan
}
