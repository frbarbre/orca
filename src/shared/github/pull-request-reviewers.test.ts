import { describe, expect, it } from 'vitest'
import { buildPullRequestReviewers } from './pull-request-reviewers'

const NONE = {
  requests: [],
  latestReviews: [],
  latestOpinionatedReviews: [],
  authorLogin: 'author'
}

describe('buildPullRequestReviewers', () => {
  it('shows a first request as pending, with no re-request', () => {
    expect(
      buildPullRequestReviewers({
        ...NONE,
        requests: [{ kind: 'user', login: 'zahlio', name: null, avatarUrl: 'z.png' }]
      })
    ).toEqual([
      {
        kind: 'user',
        login: 'zahlio',
        name: null,
        avatarUrl: 'z.png',
        state: 'pending',
        canRerequest: false
      }
    ])
  })

  it('tells a re-request from a first request by the review GitHub still keeps', () => {
    const [reviewer] = buildPullRequestReviewers({
      ...NONE,
      requests: [{ kind: 'user', login: 'frbarbre', name: null, avatarUrl: null }],
      // Why empty: GitHub drops a re-requested reviewer from latestReviews.
      latestReviews: [],
      latestOpinionatedReviews: [
        { login: 'frbarbre', avatarUrl: 'f.png', state: 'CHANGES_REQUESTED' }
      ]
    })

    expect(reviewer).toMatchObject({
      state: 're-requested',
      avatarUrl: 'f.png',
      canRerequest: false
    })
  })

  it('shows each finished review, and offers to request it again', () => {
    expect(
      buildPullRequestReviewers({
        ...NONE,
        latestReviews: [
          { login: 'MartinBernstorff', avatarUrl: 'm.png', state: 'CHANGES_REQUESTED' },
          { login: 'frbarbre', avatarUrl: 'f.png', state: 'COMMENTED' }
        ],
        latestOpinionatedReviews: [
          { login: 'MartinBernstorff', avatarUrl: 'm.png', state: 'CHANGES_REQUESTED' },
          { login: 'frbarbre', avatarUrl: 'f.png', state: 'APPROVED' }
        ]
      }).map((reviewer) => [reviewer.login, reviewer.state, reviewer.canRerequest])
    ).toEqual([
      ['MartinBernstorff', 'changes-requested', true],
      // Why approved: a later plain comment does not undo an approval.
      ['frbarbre', 'approved', true]
    ])
  })

  it('shows a comment-only review as commented', () => {
    expect(
      buildPullRequestReviewers({
        ...NONE,
        latestReviews: [{ login: 'colleague', avatarUrl: null, state: 'COMMENTED' }]
      })[0]?.state
    ).toBe('commented')
  })

  it('lists a requested team, and leaves the author out', () => {
    expect(
      buildPullRequestReviewers({
        ...NONE,
        requests: [{ kind: 'team', login: 'frontend', name: 'Frontend' }],
        latestReviews: [{ login: 'Author', avatarUrl: null, state: 'COMMENTED' }]
      }).map((reviewer) => [reviewer.kind, reviewer.login, reviewer.state])
    ).toEqual([['team', 'frontend', 'pending']])
  })
})
