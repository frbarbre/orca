import { describe, expect, it } from 'vitest'
import { mapGraphQLCheckRunContext, mapRestCheckRun } from './pr-checks-response-mapping'

describe('check run timing', () => {
  it('keeps when a GraphQL check run started and finished', () => {
    expect(
      mapGraphQLCheckRunContext({
        __typename: 'CheckRun',
        name: 'lint',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        startedAt: '2026-10-19T14:00:00Z',
        completedAt: '2026-10-19T14:04:05Z'
      })
    ).toMatchObject({
      startedAt: '2026-10-19T14:00:00Z',
      completedAt: '2026-10-19T14:04:05Z'
    })
  })

  it('keeps when a REST check run started, while it has not finished', () => {
    const check = mapRestCheckRun({
      name: 'checks',
      status: 'in_progress',
      conclusion: null,
      html_url: 'https://github.com/acme/app/runs/1',
      details_url: null,
      started_at: '2026-10-19T14:00:00Z',
      completed_at: null
    })
    expect(check.startedAt).toBe('2026-10-19T14:00:00Z')
    expect(check).not.toHaveProperty('completedAt')
  })
})
