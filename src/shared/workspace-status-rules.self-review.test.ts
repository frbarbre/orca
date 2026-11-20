import { describe, expect, it } from 'vitest'
import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'
import {
  DEFAULT_MERGING_CHECK_NAME,
  DEFAULT_SELF_REVIEW_LABEL,
  WORKSPACE_STATUS_RULE_CONDITIONS
} from './workspace-status-rule-config'
import { lowercaseLoginSet, resolveWorkspaceStatusRuleCondition } from './workspace-status-rules'

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
    labels: [DEFAULT_SELF_REVIEW_LABEL],
    ...overrides
  }
}

const viewer = 'frbarbre'
const noPmTeam = lowercaseLoginSet([])
const mapped = {
  mergingCheckName: DEFAULT_MERGING_CHECK_NAME,
  statusByCondition: { 'self-review': 'self', 'merge-queue': 'queued', conflicts: 'conflicts' }
}
const unmapped = { mergingCheckName: DEFAULT_MERGING_CHECK_NAME, statusByCondition: {} }
const passedGate = [{ name: DEFAULT_MERGING_CHECK_NAME, state: 'success' as const }]

function resolve(
  pr: ReviewSnapshotPullRequest,
  config: Parameters<typeof resolveWorkspaceStatusRuleCondition>[1] = mapped,
  login = viewer
): string | null {
  return resolveWorkspaceStatusRuleCondition(pr, config, noPmTeam, login)
}

describe('self-review condition', () => {
  it('is evaluated right after draft', () => {
    const order = [...WORKSPACE_STATUS_RULE_CONDITIONS]
    expect(order.indexOf('self-review')).toBe(order.indexOf('draft') + 1)
  })

  it('applies to your ready, agent-reviewed pull request with no human reviewer', () => {
    expect(resolve(makePR())).toBe('self-review')
  })

  it('outranks a passed merge gate, since merging needs no approval any more', () => {
    expect(resolve(makePR({ checks: passedGate }))).toBe('self-review')
  })

  it('ignores reviews from bots', () => {
    const pr = makePR({
      latestReviews: [
        { login: 'flowbase-farm-bot', state: 'COMMENTED', commitOid: null, isBot: true }
      ]
    })
    expect(resolve(pr)).toBe('self-review')
  })

  it('matches the label ignoring case', () => {
    expect(resolve(makePR({ labels: ['Reviewed-By-Flowbase-Agent'] }))).toBe('self-review')
  })

  it('uses the configured label', () => {
    const custom = { ...mapped, selfReviewLabel: 'self-check' }
    expect(resolve(makePR(), custom)).toBe('review')
    expect(resolve(makePR({ labels: ['self-check'] }), custom)).toBe('self-review')
  })

  it('does not apply without the label', () => {
    expect(resolve(makePR({ labels: [] }))).toBe('review')
    expect(resolve(makePR({ labels: undefined }))).toBe('review')
  })

  it('falls back to review once a human reviewer is requested', () => {
    expect(resolve(makePR({ requestedReviewers: [{ kind: 'user', login: 'teammate' }] }))).toBe(
      'review'
    )
    expect(resolve(makePR({ requestedReviewers: [{ kind: 'team', slug: 'frontend' }] }))).toBe(
      'review'
    )
  })

  it('falls back once a human has reviewed, even without being requested', () => {
    const pr = makePR({
      latestReviews: [{ login: 'teammate', state: 'COMMENTED', commitOid: null }]
    })
    expect(resolve(pr)).toBe('review')
  })

  it('moves to merging once a human approved and the gate passed', () => {
    const pr = makePR({
      checks: passedGate,
      latestReviews: [{ login: 'teammate', state: 'APPROVED', commitOid: null }]
    })
    expect(resolve(pr)).toBe('merging')
  })

  it('leaves your own comments out of it', () => {
    const pr = makePR({
      latestReviews: [{ login: 'FRBARBRE', state: 'COMMENTED', commitOid: null }]
    })
    expect(resolve(pr)).toBe('self-review')
  })

  it('yields to the merge queue, conflicts and draft', () => {
    expect(resolve(makePR({ isInMergeQueue: true }))).toBe('merge-queue')
    expect(resolve(makePR({ mergeable: 'CONFLICTING' }))).toBe('conflicts')
    expect(resolve(makePR({ isDraft: true }))).toBe('draft')
  })

  it("keeps someone else's pull request in reviewing", () => {
    expect(resolve(makePR({ author: 'teammate' }))).toBe('reviewing')
  })

  it('changes nothing while self-review has no column', () => {
    const cases: [ReviewSnapshotPullRequest, string][] = [
      [makePR(), 'review'],
      [makePR({ checks: passedGate }), 'merging'],
      [makePR({ isInMergeQueue: true }), 'review'],
      [makePR({ isDraft: true }), 'draft']
    ]
    for (const [pr, expected] of cases) {
      expect(resolve(pr, unmapped)).toBe(expected)
    }
  })
})
