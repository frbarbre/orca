import { describe, expect, it } from 'vitest'
import type {
  ReviewSnapshotPullRequest,
  ReviewStatusSnapshot
} from './github/review-status-snapshot-types'
import {
  cloneDefaultWorkspaceStatusRuleConfig,
  makeHandledPullRequestKey
} from './workspace-status-rule-config'
import {
  buildWorkspaceStatusRulePlan,
  releasedWorkspaceStatusRuleTargets,
  type WorkspaceStatusRuleTarget
} from './workspace-status-rule-plan'

const repo = { owner: 'flowbasedk', repo: 'flowbase' }

function makePR(overrides: Partial<ReviewSnapshotPullRequest> = {}): ReviewSnapshotPullRequest {
  return {
    repo,
    number: 1,
    title: 'Add a thing',
    url: 'https://github.com/flowbasedk/flowbase/pull/1',
    author: 'frbarbre',
    isDraft: false,
    state: 'OPEN',
    headRefName: 'feat/thing',
    baseRefName: 'main',
    headRefOid: 'abc',
    requestedReviewers: [],
    latestReviews: [],
    checks: [],
    ...overrides
  }
}

function makeSnapshot(overrides: Partial<ReviewStatusSnapshot> = {}): ReviewStatusSnapshot {
  return {
    viewerLogin: 'frbarbre',
    linkedPullRequests: [],
    reviewRequestedPullRequests: [],
    pmApprovalTeamLogins: [],
    fetchedAt: 0,
    ...overrides
  }
}

function makeTarget(overrides: Partial<WorkspaceStatusRuleTarget> = {}): WorkspaceStatusRuleTarget {
  return {
    worktreeId: 'repo::/w/one',
    executionHostId: 'local',
    displayName: 'one',
    repo,
    prNumber: 1,
    hasPendingReviewComments: false,
    currentStatus: 'todo',
    headOid: 'abc',
    ...overrides
  }
}

const enabled = {
  ...cloneDefaultWorkspaceStatusRuleConfig(),
  enabled: true,
  statusByCondition: {
    draft: 'draft-col',
    review: 'review-col',
    merged: 'done-col',
    'changes-requested': 'changes-col'
  }
}

const noBranches = new Set<string>()

describe('buildWorkspaceStatusRulePlan — statuses', () => {
  it('plans nothing while the rules are disabled', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: { ...enabled, enabled: false },
      existingBranches: noBranches
    })

    expect(plan.statusUpdates).toEqual([])
  })

  it('moves a workspace whose pull request changed condition', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.statusUpdates).toEqual([
      {
        worktreeId: 'repo::/w/one',
        executionHostId: 'local',
        status: 'draft-col',
        condition: 'draft'
      }
    ])
  })

  it('leaves a workspace alone when it is already in the right column', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ currentStatus: 'draft-col' })],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.statusUpdates).toEqual([])
  })

  it('ignores a workspace whose pull request is missing from the snapshot', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ prNumber: 99 })],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR()] }),
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.statusUpdates).toEqual([])
  })

  it('matches repositories case-insensitively', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ repo: { owner: 'FlowbaseDK', repo: 'Flowbase' } })],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.statusUpdates).toHaveLength(1)
  })
})

describe('buildWorkspaceStatusRulePlan — merged workspaces', () => {
  const merged = makeSnapshot({ linkedPullRequests: [makePR({ state: 'MERGED' })] })

  it('only moves the card when delete-on-merge is off', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: merged,
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.removals).toEqual([])
    expect(plan.statusUpdates.map((update) => update.status)).toEqual(['done-col'])
  })

  it('removes the workspace when delete-on-merge is on', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: merged,
      config: { ...enabled, onResolved: 'delete' },
      existingBranches: noBranches
    })

    expect(plan.removals).toEqual([
      { worktreeId: 'repo::/w/one', executionHostId: 'local', displayName: 'one' }
    ])
    expect(plan.statusUpdates).toEqual([])
  })

  it('never plans both a removal and a status move for the same workspace', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: merged,
      config: { ...enabled, onResolved: 'delete' },
      existingBranches: noBranches
    })

    expect(plan.removals).toHaveLength(1)
    expect(plan.statusUpdates).toEqual([])
  })
})

describe('buildWorkspaceStatusRulePlan — closed without merging', () => {
  const closed = makeSnapshot({ linkedPullRequests: [makePR({ state: 'CLOSED' })] })

  it('removes the workspace on the same switch as a merge', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: closed,
      config: { ...enabled, onResolved: 'delete' },
      existingBranches: noBranches
    })

    expect(plan.removals).toEqual([
      { worktreeId: 'repo::/w/one', executionHostId: 'local', displayName: 'one' }
    ])
  })

  it('keeps a workspace that is not at the pull request head', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ headOid: 'local-work' })],
      snapshot: closed,
      config: { ...enabled, onResolved: 'delete' },
      existingBranches: noBranches
    })

    expect(plan.removals).toEqual([])
  })

  it('keeps the workspace when the switch is off', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: closed,
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.removals).toEqual([])
  })
})

describe('buildWorkspaceStatusRulePlan — review inbox', () => {
  const inboxConfig = {
    ...enabled,
    reviewInbox: { ...enabled.reviewInbox, enabled: true }
  }
  const inbox = makeSnapshot({
    reviewRequestedPullRequests: [
      makePR({ number: 7, headRefName: 'feat/theirs', author: 'colleague' })
    ]
  })

  it('plans a workspace for a new review request', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: inbox,
      config: inboxConfig,
      existingBranches: noBranches
    })

    expect(plan.creations.map((creation) => creation.handledKey)).toEqual(['flowbasedk/flowbase#7'])
  })

  it('clones every outstanding review request on the first tick', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: Array.from({ length: 8 }, (_, index) =>
          makePR({ number: index + 1, headRefName: `feat/${index}`, author: 'colleague' })
        )
      }),
      config: inboxConfig,
      existingBranches: noBranches
    })

    expect(plan.creations).toHaveLength(8)
  })

  it('skips a pull request already handled', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: inbox,
      config: { ...inboxConfig, handledPullRequests: ['flowbasedk/flowbase#7'] },
      existingBranches: noBranches
    })

    expect(plan.creations).toEqual([])
  })

  it('skips a pull request the viewer authored', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [makePR({ number: 7, author: 'FrBarbre' })]
      }),
      config: inboxConfig,
      existingBranches: noBranches
    })

    expect(plan.creations).toEqual([])
  })

  it('skips a pull request whose branch already has a workspace', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: inbox,
      config: inboxConfig,
      existingBranches: new Set(['feat/theirs'])
    })

    expect(plan.creations).toEqual([])
  })

  it('skips a pull request that is already a linked workspace', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ prNumber: 7 })],
      snapshot: inbox,
      config: inboxConfig,
      existingBranches: noBranches
    })

    expect(plan.creations).toEqual([])
  })

  it('caps how many workspaces one tick may create', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: Array.from({ length: 10 }, (_, index) =>
          makePR({ number: index + 1, headRefName: `feat/${index}`, author: 'colleague' })
        )
      }),
      config: inboxConfig,
      existingBranches: noBranches,
      maxCreations: 3
    })

    expect(plan.creations).toHaveLength(3)
  })

  it('plans nothing when the inbox is off', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: inbox,
      config: enabled,
      existingBranches: noBranches
    })

    expect(plan.creations).toEqual([])
  })
})

describe('a workspace in the hold column', () => {
  const held = makeTarget({ currentStatus: 'on-hold' })
  const holding = { ...enabled, holdStatus: 'on-hold', onResolved: 'delete' as const }

  it('is never moved by a pull request state', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [held],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: holding,
      existingBranches: noBranches
    })
    expect(plan.statusUpdates).toStrictEqual([])
  })

  it('is never removed once its pull request merges', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [held],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ state: 'MERGED' })] }),
      config: holding,
      existingBranches: noBranches
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('is never removed once you have reviewed', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [held],
      snapshot: makeSnapshot({
        linkedPullRequests: [
          makePR({
            author: 'colleague',
            latestReviews: [{ login: 'frbarbre', state: 'APPROVED', commitOid: 'sha' }]
          })
        ]
      }),
      config: { ...holding, onReviewed: 'delete' as const },
      existingBranches: noBranches
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('still counts as the pull request having a workspace, so the inbox never clones it', () => {
    const requested = makePR({ author: 'colleague', headRefName: 'feat/other' })
    const plan = buildWorkspaceStatusRulePlan({
      targets: [held],
      snapshot: makeSnapshot({ reviewRequestedPullRequests: [requested] }),
      config: { ...holding, reviewInbox: { ...holding.reviewInbox, enabled: true } },
      existingBranches: noBranches
    })
    expect(plan.creations).toStrictEqual([])
  })

  it('moves again once it is put in any other column', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ currentStatus: 'todo' })],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ isDraft: true })] }),
      config: holding,
      existingBranches: noBranches
    })
    expect(plan.statusUpdates.map((update) => update.status)).toStrictEqual(['draft-col'])
  })

  it('is left out of the head sync', () => {
    expect(
      releasedWorkspaceStatusRuleTargets([held, makeTarget({ worktreeId: 'two' })], holding).map(
        (target) => target.worktreeId
      )
    ).toStrictEqual(['two'])
  })
})

describe('closing a workspace once you have reviewed', () => {
  const reviewedPR = makePR({
    author: 'colleague',
    latestReviews: [{ login: 'frbarbre', state: 'APPROVED', commitOid: 'reviewed-sha' }]
  })
  const config = {
    ...cloneDefaultWorkspaceStatusRuleConfig(),
    enabled: true,
    onReviewed: 'delete' as const
  }

  it('removes the workspace and lets the inbox open it again later', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [reviewedPR] }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([
      {
        worktreeId: 'repo::/w/one',
        executionHostId: 'local',
        displayName: 'one',
        forgetHandledKey: 'flowbasedk/flowbase#1',
        force: true
      }
    ])
  })

  const inboxHandled = {
    ...config,
    reviewInbox: { ...config.reviewInbox, enabled: true },
    handledPullRequests: ['flowbasedk/flowbase#1']
  }

  it('removes a workspace the inbox opened once your review request is taken back', () => {
    const unassigned = makePR({ author: 'colleague' })
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [unassigned] }),
      config: inboxHandled,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([
      {
        worktreeId: 'repo::/w/one',
        executionHostId: 'local',
        displayName: 'one',
        forgetHandledKey: 'flowbasedk/flowbase#1',
        force: true
      }
    ])
  })

  it('keeps a workspace while a team you belong to may still owe the review', () => {
    const viaTeam = makePR({
      author: 'colleague',
      requestedReviewers: [{ kind: 'team', slug: 'frontend' }]
    })
    const handled = inboxHandled
    const stillOwed = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({
        linkedPullRequests: [makePR({ author: 'colleague' })],
        reviewRequestedPullRequests: [makePR({ author: 'colleague' })]
      }),
      config: handled,
      existingBranches: new Set()
    })
    const teamPending = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [viaTeam] }),
      config: handled,
      existingBranches: new Set()
    })
    expect(stillOwed.removals).toStrictEqual([])
    expect(teamPending.removals).toStrictEqual([])
  })

  it('keeps a workspace you opened yourself on a pull request you were never asked to review', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [makePR({ author: 'colleague' })] }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('keeps a workspace whose review request is taken back after you only commented', () => {
    const commented = makePR({
      author: 'colleague',
      latestReviews: [{ login: 'frbarbre', state: 'COMMENTED', commitOid: 'sha' }]
    })
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [commented] }),
      config: inboxHandled,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('keeps the workspace while a review is still owed', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({
        linkedPullRequests: [
          {
            ...reviewedPR,
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          }
        ]
      }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('keeps the workspace when your newest review only comments, even after an earlier approval', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({
        linkedPullRequests: [
          {
            ...reviewedPR,
            latestReviews: [{ login: 'frbarbre', state: 'COMMENTED', commitOid: 'newer-sha' }],
            latestOpinionatedReviews: [
              { login: 'frbarbre', state: 'APPROVED', commitOid: 'reviewed-sha' }
            ]
          }
        ]
      }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('removes the workspace once you request changes', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({
        linkedPullRequests: [
          {
            ...reviewedPR,
            latestReviews: [
              { login: 'frbarbre', state: 'CHANGES_REQUESTED', commitOid: 'reviewed-sha' }
            ]
          }
        ]
      }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toHaveLength(1)
  })

  it('keeps a workspace holding unsent review comments', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget({ hasPendingReviewComments: true })],
      snapshot: makeSnapshot({ linkedPullRequests: [reviewedPR] }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('keeps the ledger entry while the pull request is still listed as owed', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({
        linkedPullRequests: [reviewedPR],
        reviewRequestedPullRequests: [reviewedPR]
      }),
      config,
      existingBranches: new Set()
    })
    expect(plan.removals[0]?.forgetHandledKey).toBeUndefined()
  })

  it('leaves the workspace alone when the setting is off', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [makeTarget()],
      snapshot: makeSnapshot({ linkedPullRequests: [reviewedPR] }),
      config: { ...config, onReviewed: 'none' },
      existingBranches: new Set()
    })
    expect(plan.removals).toStrictEqual([])
  })

  it('re-opens a reviewed pull request on the commit that review was left on', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          {
            ...reviewedPR,
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          }
        ]
      }),
      config: { ...config, reviewInbox: { ...config.reviewInbox, enabled: true } },
      existingBranches: new Set()
    })
    expect(plan.creations.map((entry) => entry.sinceReviewCommit)).toStrictEqual(['reviewed-sha'])
  })

  it('finds the reviewed commit once GitHub has dropped the review for the re-request', () => {
    // Why this shape: GitHub leaves a re-requested reviewer out of latestReviews and keeps their
    // review only in latestOpinionatedReviews, so this is what a re-request really looks like.
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          {
            ...reviewedPR,
            latestReviews: [],
            latestOpinionatedReviews: reviewedPR.latestReviews,
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          }
        ]
      }),
      config: { ...config, reviewInbox: { ...config.reviewInbox, enabled: true } },
      existingBranches: new Set()
    })
    expect(plan.creations.map((entry) => entry.sinceReviewCommit)).toStrictEqual(['reviewed-sha'])
  })

  it('clones a re-request again although the pull request was handled before', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          {
            ...reviewedPR,
            latestReviews: [],
            latestOpinionatedReviews: reviewedPR.latestReviews,
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          }
        ]
      }),
      config: {
        ...config,
        reviewInbox: { ...config.reviewInbox, enabled: true },
        handledPullRequests: [makeHandledPullRequestKey(reviewedPR.repo, reviewedPR.number)]
      },
      existingBranches: new Set()
    })
    expect(plan.creations.map((entry) => entry.handledKey)).toStrictEqual([
      makeHandledPullRequestKey(reviewedPR.repo, reviewedPR.number, 'reviewed-sha')
    ])
  })

  it('clones a re-request after a comment-only review although the pull request was handled before', () => {
    // Why this shape: GitHub lists a re-requested reviewer's comment review in neither list, only
    // as the viewer's own latest review.
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          {
            ...reviewedPR,
            latestReviews: [],
            latestOpinionatedReviews: [],
            viewerLatestReview: { state: 'COMMENTED', commitOid: 'commented-sha' },
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          }
        ]
      }),
      config: {
        ...config,
        reviewInbox: { ...config.reviewInbox, enabled: true },
        handledPullRequests: [makeHandledPullRequestKey(reviewedPR.repo, reviewedPR.number)]
      },
      existingBranches: new Set()
    })
    expect(plan.creations.map((entry) => entry.handledKey)).toStrictEqual([
      makeHandledPullRequestKey(reviewedPR.repo, reviewedPR.number, 'commented-sha')
    ])
  })

  it('does not clone the same re-request twice', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          { ...reviewedPR, requestedReviewers: [{ kind: 'user', login: 'frbarbre' }] }
        ]
      }),
      config: {
        ...config,
        reviewInbox: { ...config.reviewInbox, enabled: true },
        handledPullRequests: [
          makeHandledPullRequestKey(reviewedPR.repo, reviewedPR.number, 'reviewed-sha')
        ]
      },
      existingBranches: new Set()
    })
    expect(plan.creations).toStrictEqual([])
  })

  it('opens a first review on the whole pull request', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: makeSnapshot({
        reviewRequestedPullRequests: [
          makePR({
            author: 'colleague',
            requestedReviewers: [{ kind: 'user', login: 'frbarbre' }]
          })
        ]
      }),
      config: { ...config, reviewInbox: { ...config.reviewInbox, enabled: true } },
      existingBranches: new Set()
    })
    expect(plan.creations.map((entry) => entry.sinceReviewCommit)).toStrictEqual([undefined])
  })
})
