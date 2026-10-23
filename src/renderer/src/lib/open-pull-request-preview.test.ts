import { beforeEach, describe, expect, it, vi } from 'vitest'

const pullRequest = vi.hoisted(() => ({
  current: null as {
    worktreeId: string
    repoPath: string
    repoId: string
    prNumber: number
    prRepo: { owner: string; repo: string } | null
  } | null
}))
const openWorkspaceFrontendUrl = vi.hoisted(() => vi.fn())

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/lib/worktree-pull-request-url', () => ({
  activeWorktreeGitHubPullRequest: () => pullRequest.current
}))
vi.mock('@/lib/open-workspace-frontend', () => ({ openWorkspaceFrontendUrl }))

import { openActivePullRequestPreview } from './open-pull-request-preview'

describe('openActivePullRequestPreview', () => {
  const prPreviewUrl = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('window', { api: { gh: { prPreviewUrl } } })
  })

  it("opens the pull request's preview deployment in the workspace", async () => {
    pullRequest.current = {
      worktreeId: 'wt-1',
      repoPath: '/code/app',
      repoId: 'repo-1',
      prNumber: 7,
      prRepo: { owner: 'acme', repo: 'app' }
    }
    prPreviewUrl.mockResolvedValue('https://abc.pages.dev')

    await expect(openActivePullRequestPreview()).resolves.toBe(true)
    expect(prPreviewUrl).toHaveBeenCalledWith({
      repoPath: '/code/app',
      repoId: 'repo-1',
      prNumber: 7,
      prRepo: { owner: 'acme', repo: 'app' }
    })
    expect(openWorkspaceFrontendUrl).toHaveBeenCalledWith('wt-1', 'https://abc.pages.dev')
  })

  it('opens nothing when the pull request has no preview deployment', async () => {
    pullRequest.current = {
      worktreeId: 'wt-1',
      repoPath: '/code/app',
      repoId: 'repo-1',
      prNumber: 7,
      prRepo: null
    }
    prPreviewUrl.mockResolvedValue(null)

    await expect(openActivePullRequestPreview()).resolves.toBe(false)
    expect(openWorkspaceFrontendUrl).not.toHaveBeenCalled()
  })

  it('opens nothing without a pull request', async () => {
    pullRequest.current = null

    await expect(openActivePullRequestPreview()).resolves.toBe(false)
    expect(prPreviewUrl).not.toHaveBeenCalled()
  })
})
