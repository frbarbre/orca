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
  maybeStartCiTriage({ repo, prNumber, prRepo: null, branch, headSha, checks })

describe('maybeStartCiTriage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { api: { pendingReview: { context: reviewContext } } })
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

  it('waits while any check is still running, such as the run on a just-pushed fix', async () => {
    await triage(41, 'feature', 'sha-running', [
      ...(failing as unknown as unknown[]),
      { name: 'ci', status: 'in_progress', conclusion: null, url: 'https://x/runs/8' }
    ] as never)

    expect(startFixChecksAgent).not.toHaveBeenCalled()
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
      checks: failing
    })
    await triage(12, 'feature', 'sha-c', [
      { name: 'checks', status: 'completed', conclusion: 'success', url: null }
    ] as never)
    await triage(13, 'no-workspace', 'sha-d')

    expect(startFixChecksAgent).not.toHaveBeenCalled()
  })
})
