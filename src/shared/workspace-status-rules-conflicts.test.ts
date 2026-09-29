import { describe, expect, it } from 'vitest'
import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'
import { DEFAULT_MERGING_CHECK_NAME } from './workspace-status-rule-config'
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
    mergeable: 'MERGEABLE',
    headRefName: 'feat/thing',
    baseRefName: 'main',
    headRefOid: 'abc123',
    requestedReviewers: [],
    latestReviews: [],
    checks: [],
    ...overrides
  }
}

const mapped = {
  mergingCheckName: DEFAULT_MERGING_CHECK_NAME,
  statusByCondition: { conflicts: 'conflicts', draft: 'draft', review: 'review' }
}
const unmapped = { mergingCheckName: DEFAULT_MERGING_CHECK_NAME, statusByCondition: {} }
const noPmTeam = lowercaseLoginSet([])
const viewer = 'frbarbre'

describe('the conflicts condition', () => {
  it('puts your conflicting pull request in Conflicts, even as a draft', () => {
    expect(
      resolveWorkspaceStatusRuleCondition(
        makePR({ mergeable: 'CONFLICTING', isDraft: true }),
        mapped,
        noPmTeam,
        viewer
      )
    ).toBe('conflicts')
  })

  it('leaves someone else’s conflicting pull request with the reviewer', () => {
    expect(
      resolveWorkspaceStatusRuleCondition(
        makePR({ mergeable: 'CONFLICTING', author: 'colleague' }),
        mapped,
        noPmTeam,
        viewer
      )
    ).toBe('reviewing')
  })

  it('holds the card while GitHub is still working out mergeability', () => {
    expect(
      resolveWorkspaceStatusRuleCondition(
        makePR({ mergeable: 'UNKNOWN' }),
        mapped,
        noPmTeam,
        viewer
      )
    ).toBeNull()
  })

  it('moves on once the conflicts are resolved', () => {
    expect(resolveWorkspaceStatusRuleCondition(makePR(), mapped, noPmTeam, viewer)).toBe('review')
  })

  it('changes nothing until Conflicts is mapped to a column', () => {
    for (const mergeable of ['CONFLICTING', 'UNKNOWN'] as const) {
      expect(
        resolveWorkspaceStatusRuleCondition(makePR({ mergeable }), unmapped, noPmTeam, viewer)
      ).toBe('review')
    }
  })
})
