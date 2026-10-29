import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeStartCiTriage } from './ci-triage-trigger'

const startFixChecksAgent = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/lib/fix-checks-agent-launch', () => ({ startFixChecksAgent }))

const worktrees = [
  { id: 'wt-feature', repoId: 'repo-1', branch: 'refs/heads/feature' },
  { id: 'wt-other', repoId: 'repo-1', branch: 'refs/heads/other' }
]
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ allWorktrees: () => worktrees }) }
}))

const reviewContext = vi.fn(async () => ({ viewerDidAuthor: true }))

const repo = {
  id: 'repo-1',
  path: '/code/app',
  connectionId: null,
  ciTriage: { prompt: 'Our Sentry is flowbasedk.sentry.io.' }
} as never
const failing = [
  { name: 'checks', status: 'completed', conclusion: 'failure', url: 'https://x/runs/7' }
] as never

const triage = (prNumber: number, branch: string, headSha: string, checks = failing) =>
  maybeStartCiTriage({ repo, prNumber, prRepo: null, branch, headSha, checks, trigger: 'watch' })

const log = vi.fn(async (_entry: unknown) => {})

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value)
  }
}

describe('maybeStartCiTriage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      api: { pendingReview: { context: reviewContext }, ciTriage: { log } },
      localStorage: memoryStorage()
    })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("starts one background triage agent in the PR's workspace per failure", async () => {
    await triage(12, 'feature', 'sha-a')
    await triage(12, 'feature', 'sha-a')

    expect(startFixChecksAgent).toHaveBeenCalledTimes(1)
    expect(startFixChecksAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-1',
        worktreeId: 'wt-feature',
        background: true,
        launchSource: 'source_control_recovery',
        basePrompt: expect.stringContaining('Our Sentry is flowbasedk.sentry.io.')
      })
    )
  })

  it("leaves alone a PR you are reviewing rather than one you wrote, and when that can't be told", async () => {
    reviewContext.mockResolvedValueOnce({ viewerDidAuthor: false })
    await triage(30, 'feature', 'sha-review')
    reviewContext.mockRejectedValueOnce(new Error('offline'))
    await triage(31, 'feature', 'sha-offline')

    expect(reviewContext).toHaveBeenCalledWith({
      repoPath: '/code/app',
      prNumber: 30,
      prRepo: null,
      connectionId: null
    })
    expect(startFixChecksAgent).not.toHaveBeenCalled()
  })

  it('leaves a failed run alone when it shows up again under the head a fix pushed', async () => {
    await triage(40, 'feature', 'before-fix')
    await triage(40, 'feature', 'after-fix')

    expect(startFixChecksAgent).toHaveBeenCalledTimes(1)
  })

  it('waits while the failed check is running again, such as on a just-pushed fix', async () => {
    await triage(41, 'feature', 'sha-rerun', [
      ...(failing as unknown as unknown[]),
      { name: 'checks', status: 'in_progress', conclusion: null, url: 'https://x/runs/8' }
    ] as never)

    expect(startFixChecksAgent).not.toHaveBeenCalled()
  })

  it('triages an early failure without waiting for unrelated checks still running', async () => {
    await triage(42, 'feature', 'sha-early', [
      { name: 'lint', status: 'completed', conclusion: 'failure', url: 'https://x/runs/9' },
      { name: 'e2e', status: 'in_progress', conclusion: null, url: 'https://x/runs/10' }
    ] as never)

    expect(startFixChecksAgent).toHaveBeenCalledTimes(1)
  })

  it('hands a later failure on the same head only the runs not already triaged', async () => {
    const lint = { name: 'lint', status: 'completed', conclusion: 'failure', url: 'https://x/l' }
    const e2e = { name: 'e2e', status: 'completed', conclusion: 'failure', url: 'https://x/e' }
    await triage(43, 'feature', 'sha-later', [lint] as never)
    await triage(43, 'feature', 'sha-later', [lint, e2e] as never)

    expect(startFixChecksAgent).toHaveBeenCalledTimes(2)
    const secondPrompt = (
      startFixChecksAgent.mock.calls[1] as unknown as [{ basePrompt: string }]
    )[0].basePrompt
    expect(secondPrompt).toContain('https://x/e')
    expect(secondPrompt).not.toContain('https://x/l')
  })

  it('starts nothing for a failed summary status without a link, which only echoes a failed run', async () => {
    const combined = { name: 'Combined CI', status: 'completed', conclusion: 'failure', url: null }
    await triage(50, 'feature', 'sha-summary')
    await triage(50, 'feature', 'sha-summary', [
      ...(failing as unknown as unknown[]),
      combined
    ] as never)
    await triage(51, 'feature', 'sha-summary-only', [combined] as never)

    expect(startFixChecksAgent).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ prNumber: 51, decision: 'no-linked-failure' })
    )
  })

  it('remembers the runs it triaged across a restart', async () => {
    await triage(52, 'feature', 'sha-restart')
    vi.resetModules()
    const restarted = await import('./ci-triage-trigger')
    await restarted.maybeStartCiTriage({
      repo,
      prNumber: 52,
      prRepo: null,
      branch: 'feature',
      headSha: 'sha-restart',
      checks: failing,
      trigger: 'checks'
    })

    expect(startFixChecksAgent).toHaveBeenCalledTimes(1)
  })

  it('logs why it started an agent, with the runs, head and what asked', async () => {
    await triage(53, 'feature', 'sha-log')
    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ decision: 'launched' }))
    )

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'started',
        trigger: 'watch',
        repoId: 'repo-1',
        prNumber: 53,
        branch: 'feature',
        headSha: 'sha-log',
        worktreeId: 'wt-feature',
        runs: [{ name: 'checks', url: 'https://x/runs/7' }],
        prStarts: 1
      })
    )
  })

  it('stops after three triage agents on one PR, so pushed fixes cannot loop', async () => {
    for (const sha of ['fix-1', 'fix-2', 'fix-3', 'fix-4', 'fix-5']) {
      await triage(21, 'feature', sha, [
        { name: 'checks', status: 'completed', conclusion: 'failure', url: `https://x/runs/${sha}` }
      ] as never)
    }

    expect(startFixChecksAgent).toHaveBeenCalledTimes(3)
  })

  it('stays out of repos without it, passing checks, and PRs with no workspace here', async () => {
    await maybeStartCiTriage({
      repo: { id: 'repo-1' } as never,
      prNumber: 12,
      prRepo: null,
      branch: 'feature',
      headSha: 'sha-b',
      checks: failing,
      trigger: 'watch'
    })
    await triage(12, 'feature', 'sha-c', [
      { name: 'checks', status: 'completed', conclusion: 'success', url: null }
    ] as never)
    await triage(13, 'no-workspace', 'sha-d')

    expect(startFixChecksAgent).not.toHaveBeenCalled()
  })
})
