import { describe, expect, it } from 'vitest'
import type {
  ReviewSnapshotPullRequest,
  ReviewStatusSnapshot
} from './github/review-status-snapshot-types'
import { cloneDefaultWorkspaceStatusRuleConfig } from './workspace-status-rule-config'
import {
  buildWorkspaceStatusRulePlan,
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
    currentStatus: 'todo',
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
    reviewInbox: { ...enabled.reviewInbox, enabled: true, seeded: true }
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

  it('records the existing queue instead of acting on it before seeding', () => {
    const plan = buildWorkspaceStatusRulePlan({
      targets: [],
      snapshot: inbox,
      config: { ...inboxConfig, reviewInbox: { ...inboxConfig.reviewInbox, seeded: false } },
      existingBranches: noBranches
    })

    expect(plan.creations).toEqual([])
    expect(plan.seededHandledKeys).toEqual(['flowbasedk/flowbase#7'])
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
    expect(plan.seededHandledKeys).toEqual([])
  })
})
