import { describe, expect, it } from 'vitest'
import { assemblePRRefreshFoundOutcome } from './pr-refresh-outcome-assembly'
import {
  mapRestPullRequest,
  PR_BRANCH_LIST_JSON_FIELDS,
  PR_LOOKUP_JSON_FIELDS,
  type PullRequestLookupData
} from './pull-request-lookup-data'

const data: PullRequestLookupData = {
  number: 7,
  title: 'Add diff chip',
  state: 'OPEN',
  url: 'https://github.com/o/r/pull/7',
  statusCheckRollup: [],
  updatedAt: '2026-11-09T00:00:00Z',
  mergeable: 'MERGEABLE'
}

function assemble(lookup: PullRequestLookupData) {
  const outcome = assemblePRRefreshFoundOutcome({
    data: lookup,
    dataRepo: null,
    dataHeadRepo: null,
    stack: undefined,
    mergeable: 'MERGEABLE',
    stackMergeQueueRequired: undefined,
    confirmedContainedHeadOid: null,
    headDivergedFromMergedPRAtOid: null,
    conflictSummary: undefined
  })
  return outcome.kind === 'found' ? outcome.pr : null
}

describe('PR diff totals', () => {
  it.each([
    ['lookup', PR_LOOKUP_JSON_FIELDS],
    ['branch list', PR_BRANCH_LIST_JSON_FIELDS]
  ])('asks gh for them in the %s fields', (_name, fields) => {
    expect(fields.split(',')).toEqual(expect.arrayContaining(['additions', 'deletions']))
  })

  it('carries them onto the PR', () => {
    expect(assemble({ ...data, additions: 12, deletions: 0 })).toMatchObject({
      additions: 12,
      deletions: 0
    })
  })

  it('leaves them off when GitHub did not report them', () => {
    expect(assemble(data)).not.toHaveProperty('additions')
  })

  it('reads them from the REST pull request', () => {
    expect(
      mapRestPullRequest({ number: 7, title: 't', state: 'open', additions: 4, deletions: 2 })
    ).toMatchObject({ additions: 4, deletions: 2 })
  })
})
