import { describe, expect, it } from 'vitest'
import { DEFAULT_MERGING_CHECK_NAME } from '../../shared/workspace-status-rule-config'
import { resolveWorkspaceStatusRuleCondition } from '../../shared/workspace-status-rules'
import { mapReviewStatusSnapshotResponse } from './review-status-snapshot-mapping'

// Why a StatusContext and not a CheckRun: flowbase's merge gate is posted as a
// commit status, so a rollup shaped like a GitHub Actions job would not prove it.
function payloadWithMergeGate(state: string, prState = 'OPEN'): unknown {
  return {
    data: {
      viewer: { login: 'frbarbre' },
      linked0: {
        pullRequest: {
          number: 3170,
          title: 'A change of mine',
          url: 'https://github.com/flowbasedk/flowbase/pull/3170',
          isDraft: false,
          state: prState,
          headRefName: 'feature/thing',
          baseRefName: 'main',
          headRefOid: 'abc',
          author: { login: 'frbarbre' },
          repository: { name: 'flowbase', owner: { login: 'flowbasedk' } },
          reviewRequests: { nodes: [] },
          latestReviews: { nodes: [] },
          commits: {
            nodes: [
              {
                commit: {
                  statusCheckRollup: {
                    contexts: {
                      nodes: [
                        { __typename: 'StatusContext', context: 'Reviews satisfied', state },
                        { __typename: 'StatusContext', context: 'Combined CI', state: 'SUCCESS' }
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
}

function conditionFor(state: string, prState = 'OPEN'): string | null {
  const [pr] = mapReviewStatusSnapshotResponse(
    payloadWithMergeGate(state, prState)
  ).linkedPullRequests
  return resolveWorkspaceStatusRuleCondition(
    pr,
    { mergingCheckName: DEFAULT_MERGING_CHECK_NAME },
    new Set(),
    'frbarbre'
  )
}

describe('the Reviews satisfied merge gate', () => {
  it('reports merging once the gate is green and the pull request is still open', () => {
    expect(conditionFor('SUCCESS')).toBe('merging')
  })

  it('stays in review while the gate is pending', () => {
    expect(conditionFor('PENDING')).toBe('review')
  })

  it('stays in review when the gate failed', () => {
    expect(conditionFor('FAILURE')).toBe('review')
  })

  it('reports merged once the pull request actually lands, gate green or not', () => {
    expect(conditionFor('SUCCESS', 'MERGED')).toBe('merged')
  })
})
