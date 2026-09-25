import { describe, expect, it } from 'vitest'
import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'
import {
  DEFAULT_MERGING_CHECK_NAME,
  cloneDefaultWorkspaceStatusRuleConfig
} from './workspace-status-rule-config'
import {
  lowercaseLoginSet,
  resolveWorkspaceStatusRule,
  resolveWorkspaceStatusRuleCondition
} from './workspace-status-rules'

function makePR(overrides: Partial<ReviewSnapshotPullRequest> = {}): ReviewSnapshotPullRequest {
  return {
    repo: { owner: 'flowbasedk', repo: 'flowbase' },
    number: 1,
    title: 'Add a thing',
    url: 'https://github.com/flowbasedk/flowbase/pull/1',
    author: 'frbarbre',
    isDraft: false,
    state: 'OPEN',
    headRefName: 'feat/thing',
    baseRefName: 'main',
    headRefOid: 'abc123',
    requestedReviewers: [],
    latestReviews: [],
    checks: [],
    ...overrides
  }
}

const config = { mergingCheckName: DEFAULT_MERGING_CHECK_NAME }
const noPmTeam = lowercaseLoginSet([])
const pmTeam = lowercaseLoginSet(['PmPerson'])
const viewer = 'frbarbre'

describe('resolveWorkspaceStatusRuleCondition', () => {
  it('reports a merged pull request before anything else', () => {
    const pr = makePR({
      state: 'MERGED',
      isDraft: true,
      checks: [{ name: DEFAULT_MERGING_CHECK_NAME, state: 'success' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('merged')
  })

  it('reports a closed-unmerged pull request as closed', () => {
    expect(
      resolveWorkspaceStatusRuleCondition(makePR({ state: 'CLOSED' }), config, pmTeam, viewer)
    ).toBe('closed')
  })

  it("reports closed for someone else's pull request you were reviewing", () => {
    const pr = makePR({ state: 'CLOSED', author: 'colleague' })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('closed')
  })

  it('reports a draft', () => {
    expect(
      resolveWorkspaceStatusRuleCondition(makePR({ isDraft: true }), config, pmTeam, viewer)
    ).toBe('draft')
  })

  it('returns to draft after a ready pull request is put back', () => {
    const ready = makePR()
    expect(resolveWorkspaceStatusRuleCondition(ready, config, pmTeam, viewer)).toBe('review')
    expect(
      resolveWorkspaceStatusRuleCondition({ ...ready, isDraft: true }, config, pmTeam, viewer)
    ).toBe('draft')
  })

  it('reports changes requested', () => {
    const pr = makePR({ latestReviews: [{ login: 'reviewer', state: 'CHANGES_REQUESTED' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe(
      'changes-requested'
    )
  })

  it('clears changes requested once that reviewer is re-requested', () => {
    const pr = makePR({
      latestReviews: [{ login: 'reviewer', state: 'CHANGES_REQUESTED' }],
      requestedReviewers: [{ kind: 'user', login: 'reviewer' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
  })

  it('matches a re-requested reviewer regardless of login casing', () => {
    const pr = makePR({
      latestReviews: [{ login: 'Reviewer', state: 'CHANGES_REQUESTED' }],
      requestedReviewers: [{ kind: 'user', login: 'reviewer' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
  })

  it('goes to PM approval when a re-request leaves only a PM pending', () => {
    const pr = makePR({
      latestReviews: [
        { login: 'reviewer', state: 'APPROVED' },
        { login: 'pmperson', state: 'CHANGES_REQUESTED' }
      ],
      requestedReviewers: [{ kind: 'user', login: 'PmPerson' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('pm-approval')
  })

  it('reports merging when the named check passed', () => {
    const pr = makePR({ checks: [{ name: 'Reviews satisfied', state: 'success' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('merging')
  })

  it('ignores the named check while it is failing or pending', () => {
    for (const state of ['failure', 'pending', 'neutral'] as const) {
      const pr = makePR({ checks: [{ name: 'Reviews satisfied', state }] })
      expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
    }
  })

  it('ignores a passing check with a different name', () => {
    const pr = makePR({ checks: [{ name: 'build', state: 'success' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
  })

  it('matches the named check ignoring case and surrounding space', () => {
    const pr = makePR({ checks: [{ name: '  reviews SATISFIED ', state: 'success' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('merging')
  })

  it('reports PM approval when a PM is the only reviewer left', () => {
    const pr = makePR({
      requestedReviewers: [{ kind: 'user', login: 'pmperson' }],
      latestReviews: [{ login: 'reviewer', state: 'APPROVED' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('pm-approval')
  })

  it('stays in review while a non-PM reviewer is still pending', () => {
    const pr = makePR({
      requestedReviewers: [
        { kind: 'user', login: 'pmperson' },
        { kind: 'user', login: 'reviewer' }
      ]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
  })

  it('stays in review when no PM team is configured', () => {
    const pr = makePR({ requestedReviewers: [{ kind: 'user', login: 'pmperson' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, noPmTeam, viewer)).toBe('review')
  })

  it('does not treat a pending team reviewer as a PM approval', () => {
    const pr = makePR({ requestedReviewers: [{ kind: 'team', slug: 'pm-approval' }] })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('review')
  })

  it('reports review for a ready pull request with no reviewers yet', () => {
    expect(resolveWorkspaceStatusRuleCondition(makePR(), config, pmTeam, viewer)).toBe('review')
  })

  it("reports reviewing for someone else's pull request", () => {
    const pr = makePR({ author: 'colleague' })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('reviewing')
  })

  it('keeps reviewing even once every check and approval has landed', () => {
    const pr = makePR({
      author: 'colleague',
      checks: [{ name: 'Reviews satisfied', state: 'success' }],
      latestReviews: [{ login: 'someone', state: 'APPROVED' }]
    })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('reviewing')
  })

  it('still deletes-or-moves a merged pull request you were reviewing', () => {
    const pr = makePR({ author: 'colleague', state: 'MERGED' })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, viewer)).toBe('merged')
  })

  it('falls back to your own columns when the viewer is unknown', () => {
    const pr = makePR({ author: 'colleague' })

    expect(resolveWorkspaceStatusRuleCondition(pr, config, pmTeam, null)).toBe('review')
  })
})

describe('resolveWorkspaceStatusRule', () => {
  it('returns no status for an unmapped condition', () => {
    const outcome = resolveWorkspaceStatusRule(
      makePR(),
      cloneDefaultWorkspaceStatusRuleConfig(),
      pmTeam,
      viewer
    )

    expect(outcome).toEqual({ condition: 'review', status: null })
  })

  it('maps a matched condition to the configured status', () => {
    const outcome = resolveWorkspaceStatusRule(
      makePR({ isDraft: true }),
      { ...cloneDefaultWorkspaceStatusRuleConfig(), statusByCondition: { draft: 'in-progress' } },
      pmTeam,
      viewer
    )

    expect(outcome).toEqual({ condition: 'draft', status: 'in-progress' })
  })

  it('leaves a closed pull request unmoved when the closed column is unmapped', () => {
    const outcome = resolveWorkspaceStatusRule(
      makePR({ state: 'CLOSED' }),
      {
        ...cloneDefaultWorkspaceStatusRuleConfig(),
        statusByCondition: { draft: 'todo', review: 'in-review', merged: 'completed' }
      },
      pmTeam,
      viewer
    )

    expect(outcome).toEqual({ condition: 'closed', status: null })
  })
})
