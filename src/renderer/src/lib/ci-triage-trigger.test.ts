import { afterEach, describe, expect, it, vi } from 'vitest'
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

const repo = { id: 'repo-1', ciTriage: { hints: 'Our Sentry is flowbasedk.sentry.io.' } } as never
const failing = [
  { name: 'checks', status: 'completed', conclusion: 'failure', url: 'https://x/runs/7' }
] as never

describe('maybeStartCiTriage', () => {
  afterEach(() => vi.clearAllMocks())

  it("starts one background triage agent in the PR's workspace per failure", () => {
    maybeStartCiTriage(repo, 12, 'feature', 'sha-a', failing)
    maybeStartCiTriage(repo, 12, 'feature', 'sha-a', failing)

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

  it('stays out of repos without it, passing checks, and PRs with no workspace here', () => {
    maybeStartCiTriage({ id: 'repo-1' } as never, 12, 'feature', 'sha-b', failing)
    maybeStartCiTriage(repo, 12, 'feature', 'sha-c', [
      { name: 'checks', status: 'completed', conclusion: 'success', url: null }
    ] as never)
    maybeStartCiTriage(repo, 13, 'no-workspace', 'sha-d', failing)

    expect(startFixChecksAgent).not.toHaveBeenCalled()
  })
})
