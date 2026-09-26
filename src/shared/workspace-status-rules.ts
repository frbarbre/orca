import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'
import type {
  WorkspaceStatusRuleCondition,
  WorkspaceStatusRuleConfig
} from './workspace-status-rule-config'
import type { WorkspaceStatus } from './worktree/types'

function pendingUserReviewerLogins(pr: ReviewSnapshotPullRequest): string[] {
  return pr.requestedReviewers
    .filter((reviewer) => reviewer.kind === 'user')
    .map((reviewer) => reviewer.login.toLowerCase())
}

// Why: GitHub keeps the old CHANGES_REQUESTED review after a re-request; what
// changes is that the author reappears as a pending requested reviewer. Reading
// the review alone would pin a PR in Changes Requested forever.
function hasUnansweredChangeRequest(pr: ReviewSnapshotPullRequest): boolean {
  const pending = new Set(pendingUserReviewerLogins(pr))
  return pr.latestReviews.some(
    (review) => review.state === 'CHANGES_REQUESTED' && !pending.has(review.login.toLowerCase())
  )
}

function hasPassingNamedCheck(pr: ReviewSnapshotPullRequest, checkName: string): boolean {
  const wanted = checkName.trim().toLowerCase()
  if (!wanted) {
    return false
  }
  return pr.checks.some(
    (check) => check.name.trim().toLowerCase() === wanted && check.state === 'success'
  )
}

// Why: "a PM is still to approve, everyone else already has". Pending reviewers
// are the ones who have not reviewed, so the test is that every remaining one
// belongs to the PM team.
function awaitsPmApproval(
  pr: ReviewSnapshotPullRequest,
  pmTeamLogins: ReadonlySet<string>
): boolean {
  if (pmTeamLogins.size === 0) {
    return false
  }
  const pending = pendingUserReviewerLogins(pr)
  return pending.length > 0 && pending.every((login) => pmTeamLogins.has(login))
}

export function resolveWorkspaceStatusRuleCondition(
  pr: ReviewSnapshotPullRequest,
  config: Pick<WorkspaceStatusRuleConfig, 'mergingCheckName'>,
  pmTeamLogins: ReadonlySet<string>,
  viewerLogin: string | null
): WorkspaceStatusRuleCondition | null {
  if (pr.state === 'MERGED') {
    return 'merged'
  }
  if (pr.state === 'CLOSED') {
    return 'closed'
  }
  // Why before every other open-state condition: someone else's pull request is
  // work you are reviewing, not work of yours waiting for review. Without this it
  // would satisfy "ready for review" and be pulled into your own review column.
  if (viewerLogin && pr.author && pr.author.toLowerCase() !== viewerLogin.toLowerCase()) {
    return 'reviewing'
  }
  if (pr.isDraft) {
    return 'draft'
  }
  if (hasUnansweredChangeRequest(pr)) {
    return 'changes-requested'
  }
  if (hasPassingNamedCheck(pr, config.mergingCheckName)) {
    return 'merging'
  }
  if (awaitsPmApproval(pr, pmTeamLogins)) {
    return 'pm-approval'
  }
  return 'review'
}

export type ViewerReviewStanding = {
  /** The viewer has left a verdict that ends their turn. */
  isFinished: boolean
  /** The viewer is on the hook again, so the pull request is theirs to look at. */
  isOwed: boolean
  /** The commit that verdict was left on, for a workspace re-opened later. */
  commitOid: string | null
}

// Why both halves: GitHub keeps the old review after a re-request, so a finished
// verdict alone never expires. What ends it is the viewer reappearing among the
// pending reviewers, which is exactly the re-request.
export function readViewerReviewStanding(
  pr: ReviewSnapshotPullRequest,
  viewerLogin: string | null
): ViewerReviewStanding {
  const viewer = viewerLogin?.toLowerCase() ?? null
  if (!viewer) {
    return { isFinished: false, isOwed: false, commitOid: null }
  }
  const review = pr.latestReviews.find((entry) => entry.login.toLowerCase() === viewer)
  const isOwed = pendingUserReviewerLogins(pr).includes(viewer)
  return {
    isFinished: !isOwed && (review?.state === 'APPROVED' || review?.state === 'CHANGES_REQUESTED'),
    isOwed,
    commitOid: review?.commitOid ?? null
  }
}

export function lowercaseLoginSet(logins: readonly string[]): ReadonlySet<string> {
  return new Set(logins.map((login) => login.toLowerCase()))
}

export type WorkspaceStatusRuleOutcome = {
  condition: WorkspaceStatusRuleCondition | null
  /** Null when the condition is unmapped, so an incomplete config never moves a card. */
  status: WorkspaceStatus | null
}

export function resolveWorkspaceStatusRule(
  pr: ReviewSnapshotPullRequest,
  config: WorkspaceStatusRuleConfig,
  pmTeamLogins: ReadonlySet<string>,
  viewerLogin: string | null
): WorkspaceStatusRuleOutcome {
  const condition = resolveWorkspaceStatusRuleCondition(pr, config, pmTeamLogins, viewerLogin)
  return {
    condition,
    status: condition ? (config.statusByCondition[condition] ?? null) : null
  }
}
