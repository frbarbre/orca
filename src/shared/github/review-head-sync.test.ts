import { describe, expect, it } from 'vitest'
import type { ReviewSnapshotPullRequest } from './review-status-snapshot-types'
import { planReviewHeadSyncs, type ReviewHeadSyncCandidate } from './review-head-sync'

const repo = { owner: 'flowbasedk', repo: 'flowbase' }

function pr(overrides: Partial<ReviewSnapshotPullRequest> = {}): ReviewSnapshotPullRequest {
  return {
    repo,
    number: 3179,
    title: 'Colour inputs',
    url: '',
    author: 'madsenmm',
    isDraft: false,
    state: 'OPEN',
    headRefName: 'feature/e-5053',
    baseRefName: 'main',
    headRefOid: 'new-head',
    requestedReviewers: [],
    latestReviews: [],
    checks: [],
    ...overrides
  }
}

const candidate: ReviewHeadSyncCandidate = {
  worktreeId: 'wt',
  worktreePath: '/w',
  branch: 'feature/e-5053',
  localHead: 'old-head',
  isLocal: true,
  repo,
  prNumber: 3179
}

function plan(p: ReviewSnapshotPullRequest, c: ReviewHeadSyncCandidate = candidate) {
  return planReviewHeadSyncs([c], { viewerLogin: 'frbarbre', linkedPullRequests: [p] })
}

describe('planReviewHeadSyncs', () => {
  it('syncs a review workspace whose pull request moved', () => {
    expect(plan(pr())).toEqual([
      { worktreeId: 'wt', worktreePath: '/w', branch: 'feature/e-5053', headOid: 'new-head' }
    ])
  })

  it('never touches your own pull requests', () => {
    expect(plan(pr({ author: 'FrBarbre' }))).toEqual([])
  })

  it('skips a workspace already on the head, a closed pull request, or a remote checkout', () => {
    expect(plan(pr({ headRefOid: 'old-head' }))).toEqual([])
    expect(plan(pr({ state: 'MERGED' }))).toEqual([])
    expect(plan(pr(), { ...candidate, isLocal: false })).toEqual([])
  })

  it('skips a workspace checked out on another branch', () => {
    expect(plan(pr({ headRefName: 'renamed' }))).toEqual([])
  })
})
