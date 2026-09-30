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
  // Why the opinionated list: latestReviews keeps only each reviewer's newest review, so a plain
  // comment after requesting changes hides the request that is still in force.
  return (pr.latestOpinionatedReviews ?? pr.latestReviews).some(
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

// Why: the approval gate is a CI check that runs a while after the last approval; until it does, a
// pull request a PM and every other reviewer approved is ready, not back in review.
function isApprovedByPmAndEveryone(
  pr: ReviewSnapshotPullRequest,
  pmTeamLogins: ReadonlySet<string>
): boolean {
  if (pmTeamLogins.size === 0 || pendingUserReviewerLogins(pr).length > 0) {
    return false
  }
  const author = pr.author?.toLowerCase()
  const verdicts = (pr.latestOpinionatedReviews ?? pr.latestReviews).filter(
    (review) => review.login.toLowerCase() !== author
  )
  return (
    verdicts.length > 0 &&
    verdicts.every((review) => review.state === 'APPROVED') &&
    verdicts.some((review) => pmTeamLogins.has(review.login.toLowerCase()))
  )
}

export function resolveWorkspaceStatusRuleCondition(
  pr: ReviewSnapshotPullRequest,
  config: Pick<WorkspaceStatusRuleConfig, 'mergingCheckName'> &
    Partial<Pick<WorkspaceStatusRuleConfig, 'statusByCondition'>>,
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
  if (config.statusByCondition?.conflicts) {
    if (pr.mergeable === 'CONFLICTING') {
      return 'conflicts'
    }
    // Why: GitHub reports UNKNOWN while it recomputes after a push; holding the card avoids a bounce out of Conflicts and back.
    if (pr.mergeable === 'UNKNOWN') {
      return null
    }
  }
  if (pr.isDraft) {
    return 'draft'
  }
  if (hasUnansweredChangeRequest(pr)) {
    return 'changes-requested'
  }
  if (
    hasPassingNamedCheck(pr, config.mergingCheckName) ||
    isApprovedByPmAndEveryone(pr, pmTeamLogins)
  ) {
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
  const byViewer = (entry: { login: string }): boolean => entry.login.toLowerCase() === viewer
  const review = pr.latestReviews.find(byViewer)
  const verdict = pr.latestOpinionatedReviews?.find(byViewer)?.state ?? review?.state
  const isOwed = pendingUserReviewerLogins(pr).includes(viewer)
  return {
    isFinished: !isOwed && (verdict === 'APPROVED' || verdict === 'CHANGES_REQUESTED'),
    isOwed,
    commitOid: review?.commitOid ?? pr.latestOpinionatedReviews?.find(byViewer)?.commitOid ?? null
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
