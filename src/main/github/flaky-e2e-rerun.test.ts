import { describe, expect, it, vi } from 'vitest'
import { considerFlakyE2eRerun, type FlakyE2eRerunDeps } from './flaky-e2e-rerun'

const report = (titles: string[]) => ({
  suites: [
    {
      specs: titles.map((title) => ({
        title,
        file: 'e2e/a.spec.ts',
        tests: [{ status: 'unexpected' }]
      }))
    }
  ]
})

function deps(overrides: Partial<FlakyE2eRerunDeps> = {}): FlakyE2eRerunDeps {
  return {
    failedRuns: async () => [{ runId: 7, attempt: 1 }],
    downloadReport: async () => report(['flaky one']),
    isKnownOnTrunk: async (test) => test.title.startsWith('flaky'),
    rerunFailedJobs: vi.fn(async () => {}),
    ...overrides
  }
}

describe('considerFlakyE2eRerun', () => {
  it('reruns a failed run whose only failed e2e tests are known flakes on main', async () => {
    const d = deps()
    const outcomes = await considerFlakyE2eRerun(d, new Set())
    expect(d.rerunFailedJobs).toHaveBeenCalledWith(7)
    expect(outcomes).toEqual([
      { runId: 7, rerun: true, reason: 'Every failed e2e test already fails on main.' }
    ])
  })

  it('leaves a run red when a failed test is new to main', async () => {
    const d = deps({ downloadReport: async () => report(['flaky one', 'brand new']) })
    const [outcome] = await considerFlakyE2eRerun(d, new Set())
    expect(outcome?.rerun).toBe(false)
    expect(d.rerunFailedJobs).not.toHaveBeenCalled()
  })

  it('leaves a run red without an e2e report, or when Sentry cannot answer', async () => {
    const noReport = deps({ downloadReport: async () => null })
    await considerFlakyE2eRerun(noReport, new Set())
    expect(noReport.rerunFailedJobs).not.toHaveBeenCalled()

    const down = deps({
      isKnownOnTrunk: async () => {
        throw new Error('Sentry 401')
      }
    })
    const [outcome] = await considerFlakyE2eRerun(down, new Set())
    expect(outcome).toEqual({
      runId: 7,
      rerun: false,
      reason: 'Sentry could not answer: Sentry 401'
    })
    expect(down.rerunFailedJobs).not.toHaveBeenCalled()
  })

  it('considers each run attempt once', async () => {
    const considered = new Set<string>()
    const d = deps()
    await considerFlakyE2eRerun(d, considered)
    await considerFlakyE2eRerun(d, considered)
    expect(d.rerunFailedJobs).toHaveBeenCalledTimes(1)
  })

  it('does not rerun a run that was already rerun', async () => {
    const d = deps({ failedRuns: async () => [{ runId: 7, attempt: 2 }] })
    await considerFlakyE2eRerun(d, new Set())
    expect(d.rerunFailedJobs).not.toHaveBeenCalled()
  })
})
