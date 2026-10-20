import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeRerunKnownFlakyE2e } from './flaky-e2e-rerun-trigger'

const toast = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('sonner', () => ({ toast }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace('{{value0}}', values?.value0 ?? '')
}))

const config = {
  sentryUrl: 'https://de.sentry.io',
  sentryOrg: 'flowbasedk',
  sentryProjectIds: ['11'],
  reportArtifact: 'e2e-report',
  reportFile: 'results.json',
  queryTemplate: 'test_file:{file} test_title:{title}'
}
const repo = { id: 'repo-1', flakyE2eRerun: config } as never
const failing = [
  { name: 'checks', status: 'completed', conclusion: 'failure', url: null },
  { name: 'lint', status: 'completed', conclusion: 'success', url: null }
] as never

describe('maybeRerunKnownFlakyE2e', () => {
  const flakyE2eRerun = vi.fn(async () => [{ runId: 7, rerun: true, reason: 'All known.' }])
  beforeEach(() => {
    vi.stubGlobal('window', { api: { pendingReview: { flakyE2eRerun } } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('asks once per failure for a repo set up for it, and says when CI was rerun', async () => {
    maybeRerunKnownFlakyE2e(repo, 12, 'sha-a', null, failing)
    maybeRerunKnownFlakyE2e(repo, 12, 'sha-a', null, failing)

    expect(flakyE2eRerun).toHaveBeenCalledTimes(1)
    expect(flakyE2eRerun).toHaveBeenCalledWith({
      repoId: 'repo-1',
      prNumber: 12,
      headSha: 'sha-a',
      prRepo: null
    })
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
  })

  it('stays quiet for a repo without the setting, or checks without a failure', () => {
    maybeRerunKnownFlakyE2e({ id: 'repo-2' } as never, 12, 'sha-b', null, failing)
    maybeRerunKnownFlakyE2e(repo, 12, 'sha-c', null, [
      { name: 'checks', status: 'in_progress', conclusion: null, url: null }
    ] as never)

    expect(flakyE2eRerun).not.toHaveBeenCalled()
  })
})
