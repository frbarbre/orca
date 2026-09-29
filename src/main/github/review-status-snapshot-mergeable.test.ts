import { describe, expect, it } from 'vitest'
import { mapReviewSnapshotPullRequest } from './review-status-snapshot-mapping'
import { buildReviewStatusSnapshotQuery } from './review-status-snapshot-query'

function pullRequest(mergeable: unknown) {
  return {
    number: 7,
    state: 'OPEN',
    mergeable,
    repository: { name: 'flowbase', owner: { login: 'flowbasedk' } }
  }
}

describe('mergeable', () => {
  it('asks GitHub for it', () => {
    expect(
      buildReviewStatusSnapshotQuery({
        linkedPullRequests: [{ repo: { owner: 'o', repo: 'r' }, number: 1 }],
        reviewInboxRepos: []
      })
    ).toContain('mergeable')
  })

  it('keeps GitHub’s verdict and treats anything else as unknown', () => {
    expect(mapReviewSnapshotPullRequest(pullRequest('CONFLICTING'))?.mergeable).toBe('CONFLICTING')
    expect(mapReviewSnapshotPullRequest(pullRequest('MERGEABLE'))?.mergeable).toBe('MERGEABLE')
    expect(mapReviewSnapshotPullRequest(pullRequest(null))?.mergeable).toBe('UNKNOWN')
  })
})
