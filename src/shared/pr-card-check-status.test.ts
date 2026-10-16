import { describe, expect, it } from 'vitest'
import { deriveCardCheckStatus, deriveCardCheckStatusFromRollup } from './pr-check-status'
import type { PRCheckDetail } from './github/check-types'

function detail(
  status: PRCheckDetail['status'],
  conclusion: PRCheckDetail['conclusion'] = null
): PRCheckDetail {
  return { name: 'check', status, conclusion, url: null }
}

describe('deriveCardCheckStatus', () => {
  it('reads a fetched check list the same way', () => {
    expect(deriveCardCheckStatus([detail('completed', 'failure'), detail('in_progress')])).toBe(
      'running'
    )
    expect(deriveCardCheckStatus([detail('completed', 'failure'), detail('queued')])).toBe(
      'failure'
    )
    expect(deriveCardCheckStatus([detail('completed', 'success'), detail('queued')])).toBe(
      'success'
    )
  })
})

const failed = { status: 'COMPLETED', conclusion: 'FAILURE' }
const passed = { status: 'COMPLETED', conclusion: 'SUCCESS' }
const running = { status: 'IN_PROGRESS', conclusion: null }
const queued = { status: 'QUEUED', conclusion: null }

describe('deriveCardCheckStatusFromRollup', () => {
  it('reads as running while any check runs, even with one already failed', () => {
    expect(deriveCardCheckStatusFromRollup([failed, running, passed])).toBe('running')
  })

  it('reads as failed once nothing runs, whatever is still queued', () => {
    expect(deriveCardCheckStatusFromRollup([failed, queued, passed])).toBe('failure')
  })

  it('reads as passing when only queued checks are left', () => {
    expect(deriveCardCheckStatusFromRollup([passed, queued])).toBe('success')
  })

  it('reads as nothing to report with only queued checks or none', () => {
    expect(deriveCardCheckStatusFromRollup([queued])).toBe('neutral')
    expect(deriveCardCheckStatusFromRollup([])).toBe('neutral')
    expect(deriveCardCheckStatusFromRollup(null)).toBe('neutral')
  })

  it('counts a pending commit status as running', () => {
    expect(deriveCardCheckStatusFromRollup([failed, { state: 'PENDING' }])).toBe('running')
  })
})
