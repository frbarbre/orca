import { beforeEach, describe, expect, it, vi } from 'vitest'

const TARGET = {
  repoPath: '/code/app',
  repoId: 'repo-1',
  prNumber: 7,
  prRepo: { owner: 'acme', repo: 'app' },
  headSha: 'abc1234',
  commentsCacheKey: 'comments-7'
}

function previewComment(url: string, createdAt: string) {
  return { isBot: true, body: `🔎 **Preview deployment** for \`abc1234\`: ${url}`, createdAt }
}

const mocks = vi.hoisted(() => ({
  target: null as typeof TARGET | null,
  commentsCache: {} as Record<string, { data: unknown[] }>,
  fetchPRComments: vi.fn(),
  openUrl: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      commentsCache: mocks.commentsCache,
      fetchPRComments: mocks.fetchPRComments
    })
  }
}))
vi.mock('@/components/right-sidebar/preview-deployment-target', () => ({
  selectPreviewTarget: () => mocks.target
}))

import { openActivePullRequestPreview } from './open-pull-request-preview'

describe('openActivePullRequestPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.target = TARGET
    mocks.commentsCache = {}
    mocks.fetchPRComments.mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { shell: { openUrl: mocks.openUrl } } })
  })

  it('opens the newest preview the preview button shows, like a click on it', async () => {
    mocks.commentsCache = {
      'comments-7': {
        data: [
          previewComment('https://old.pages.dev', '2026-10-20T10:00:00Z'),
          previewComment('https://new.pages.dev', '2026-10-21T10:00:00Z')
        ]
      }
    }

    await expect(openActivePullRequestPreview()).resolves.toBe(true)
    expect(mocks.openUrl).toHaveBeenCalledWith('https://new.pages.dev')
    expect(mocks.fetchPRComments).not.toHaveBeenCalled()
  })

  it("loads the pull request's comments when none are cached yet", async () => {
    mocks.fetchPRComments.mockImplementation(() => {
      mocks.commentsCache['comments-7'] = {
        data: [previewComment('https://fresh.pages.dev', '2026-10-21T10:00:00Z')]
      }
      return Promise.resolve()
    })

    await expect(openActivePullRequestPreview()).resolves.toBe(true)
    expect(mocks.fetchPRComments).toHaveBeenCalledWith('/code/app', 7, {
      repoId: 'repo-1',
      prRepo: { owner: 'acme', repo: 'app' }
    })
    expect(mocks.openUrl).toHaveBeenCalledWith('https://fresh.pages.dev')
  })

  it('opens nothing when the pull request has no preview comment', async () => {
    mocks.commentsCache = { 'comments-7': { data: [] } }

    await expect(openActivePullRequestPreview()).resolves.toBe(false)
    expect(mocks.openUrl).not.toHaveBeenCalled()
  })

  it('opens nothing without a pull request', async () => {
    mocks.target = null

    await expect(openActivePullRequestPreview()).resolves.toBe(false)
    expect(mocks.fetchPRComments).not.toHaveBeenCalled()
  })
})
