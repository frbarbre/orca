import { describe, expect, it } from 'vitest'
import { formatCheckDuration } from './check-duration'

const start = '2026-10-19T14:00:00Z'
const at = (iso: string): number => Date.parse(iso)

describe('formatCheckDuration', () => {
  it('says how long a finished check ran', () => {
    const check = {
      status: 'completed' as const,
      startedAt: start,
      completedAt: '2026-10-19T14:04:05Z'
    }
    expect(formatCheckDuration(check, at('2026-10-19T15:00:00Z'))).toBe('4m 5s')
  })

  it('says how long a running check has been running so far', () => {
    expect(
      formatCheckDuration({ status: 'in_progress', startedAt: start }, at('2026-10-19T14:00:42Z'))
    ).toBe('42s')
    expect(
      formatCheckDuration({ status: 'in_progress', startedAt: start }, at('2026-10-19T15:03:10Z'))
    ).toBe('1h 3m')
  })

  it('says nothing for a check that has not started or has no times', () => {
    expect(formatCheckDuration({ status: 'queued', startedAt: start }, at(start))).toBeNull()
    expect(formatCheckDuration({ status: 'completed' }, at(start))).toBeNull()
    expect(
      formatCheckDuration({ status: 'completed', startedAt: start }, at('2026-10-19T14:05:00Z'))
    ).toBeNull()
  })
})
