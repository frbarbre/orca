import { describe, expect, it } from 'vitest'
import { mapReviewStatusSnapshotResponse } from './review-status-snapshot-mapping'
import {
  buildReviewStatusSnapshotQuery,
  MAX_SNAPSHOT_LINKED_PRS,
  snapshotLinkedPRAlias
} from './review-status-snapshot-query'

const payload = {
  data: {
    viewer: { login: 'frbarbre' },
    linked0: {
      pullRequest: {
        number: 3145,
        title: 'Tidy the timeline',
        url: 'https://github.com/flowbasedk/flowbase/pull/3145',
        isDraft: false,
        state: 'OPEN',
        headRefName: 'fix/timeline',
        baseRefName: 'main',
        headRefOid: 'abc123',
        author: { login: 'frbarbre' },
        repository: { name: 'flowbase', owner: { login: 'flowbasedk' } },
        reviewRequests: {
          nodes: [
            { requestedReviewer: { __typename: 'User', login: 'pmperson' } },
            { requestedReviewer: { __typename: 'Team', slug: 'pm-approval' } },
            { requestedReviewer: null }
          ]
        },
        latestReviews: {
          nodes: [
            { state: 'APPROVED', author: { login: 'reviewer' } },
            { state: 'COMMENTED', author: null }
          ]
        },
        commits: {
          nodes: [
            {
              commit: {
                statusCheckRollup: {
                  contexts: {
                    nodes: [
                      {
                        __typename: 'CheckRun',
                        name: 'Reviews satisfied',
                        status: 'COMPLETED',
                        conclusion: 'SUCCESS'
                      },
                      {
                        __typename: 'CheckRun',
                        name: 'build',
                        status: 'IN_PROGRESS',
                        conclusion: null
                      },
                      {
                        __typename: 'CheckRun',
                        name: 'flaky',
                        status: 'COMPLETED',
                        conclusion: 'SKIPPED'
                      },
                      { __typename: 'StatusContext', context: 'legacy/ci', state: 'FAILURE' }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    },
    linked1: { pullRequest: null },
    inbox: {
      nodes: [
        {
          number: 12,
          title: 'A colleague change',
          url: 'https://github.com/flowbasedk/flowbase/pull/12',
          isDraft: false,
          state: 'OPEN',
          headRefName: 'feat/colleague',
          baseRefName: 'main',
          headRefOid: 'def456',
          author: { login: 'colleague' },
          repository: { name: 'flowbase', owner: { login: 'flowbasedk' } },
          reviewRequests: { nodes: [] },
          latestReviews: { nodes: [] },
          commits: { nodes: [] }
        },
        {}
      ]
    }
  }
}

describe('mapReviewStatusSnapshotResponse', () => {
  it('maps the viewer, the linked pull requests and the review inbox', () => {
    const snapshot = mapReviewStatusSnapshotResponse(payload)

    expect(snapshot.viewerLogin).toBe('frbarbre')
    expect(snapshot.linkedPullRequests).toHaveLength(1)
    expect(snapshot.reviewRequestedPullRequests.map((pr) => pr.number)).toEqual([12])
  })

  it('keeps a team reviewer that upstream mapping would drop', () => {
    const [pr] = mapReviewStatusSnapshotResponse(payload).linkedPullRequests

    expect(pr.requestedReviewers).toEqual([
      { kind: 'user', login: 'pmperson' },
      { kind: 'team', slug: 'pm-approval' }
    ])
  })

  it('keeps the check names and normalizes their states', () => {
    const [pr] = mapReviewStatusSnapshotResponse(payload).linkedPullRequests

    expect(pr.checks).toEqual([
      { name: 'Reviews satisfied', state: 'success' },
      { name: 'build', state: 'pending' },
      { name: 'flaky', state: 'neutral' },
      { name: 'legacy/ci', state: 'failure' }
    ])
  })

  it('drops reviews with no author', () => {
    const [pr] = mapReviewStatusSnapshotResponse(payload).linkedPullRequests

    expect(pr.latestReviews).toEqual([{ login: 'reviewer', state: 'APPROVED' }])
  })

  it('survives an empty or malformed payload', () => {
    for (const value of [null, undefined, {}, { data: null }, { data: { linked0: 7 } }]) {
      expect(mapReviewStatusSnapshotResponse(value)).toEqual({
        viewerLogin: null,
        linkedPullRequests: [],
        reviewRequestedPullRequests: []
      })
    }
  })
})

describe('buildReviewStatusSnapshotQuery', () => {
  it('emits one alias per linked pull request and omits the inbox when not asked', () => {
    const query = buildReviewStatusSnapshotQuery({
      linkedPullRequests: [
        { repo: { owner: 'flowbasedk', repo: 'flowbase' }, number: 1 },
        { repo: { owner: 'frbarbre', repo: 'orca' }, number: 2 }
      ],
      reviewInboxRepos: []
    })

    expect(query).toContain(`${snapshotLinkedPRAlias(0)}: repository(owner: "flowbasedk"`)
    expect(query).toContain(`${snapshotLinkedPRAlias(1)}: repository(owner: "frbarbre"`)
    expect(query).not.toContain('inbox: search')
  })

  it('caps the number of aliases so the document stays bounded', () => {
    const query = buildReviewStatusSnapshotQuery({
      linkedPullRequests: Array.from({ length: MAX_SNAPSHOT_LINKED_PRS + 10 }, (_, index) => ({
        repo: { owner: 'flowbasedk', repo: 'flowbase' },
        number: index + 1
      })),
      reviewInboxRepos: [{ owner: 'flowbasedk', repo: 'flowbase' }]
    })

    expect(query).toContain(snapshotLinkedPRAlias(MAX_SNAPSHOT_LINKED_PRS - 1))
    expect(query).not.toContain(snapshotLinkedPRAlias(MAX_SNAPSHOT_LINKED_PRS))
    expect(query).toContain('inbox: search')
    expect(query).toContain('repo:flowbasedk/flowbase')
  })
})
