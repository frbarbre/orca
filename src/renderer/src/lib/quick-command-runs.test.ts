import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quickCommandRunningIn, trackQuickCommandRun } from './quick-command-runs'

describe('quick command runs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('belongs to its terminal while its process runs, and is done as soon as it stops', async () => {
    const verdicts = ['live', 'live', 'exited'] as const
    let call = 0
    trackQuickCommandRun('term-1', 'mr fu', async () => verdicts[call++] ?? 'exited')

    expect(quickCommandRunningIn('term-1')).toBe('mr fu')
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(quickCommandRunningIn('term-1')).toBe('mr fu')
    await vi.advanceTimersByTimeAsync(2000)
    expect(quickCommandRunningIn('term-1')).toBeNull()
  })

  it('is done once a command too short to be seen running has had time to start', async () => {
    trackQuickCommandRun('term-2', 'mr bd', async () => 'exited')

    await vi.advanceTimersByTimeAsync(4000)
    expect(quickCommandRunningIn('term-2')).toBe('mr bd')
    await vi.advanceTimersByTimeAsync(2000)
    expect(quickCommandRunningIn('term-2')).toBeNull()
  })

  it('hands the terminal to the next command run in it', async () => {
    trackQuickCommandRun('term-3', 'mr bd', async () => 'exited')
    trackQuickCommandRun('term-3', 'mr fu', async () => 'live')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(quickCommandRunningIn('term-3')).toBe('mr fu')
  })

  it('forgets a run whose terminal is gone', async () => {
    trackQuickCommandRun('term-4', 'mr fu', async () => 'gone')

    await vi.advanceTimersByTimeAsync(2000)
    expect(quickCommandRunningIn('term-4')).toBeNull()
  })
})
