import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ghExecFileAsync: vi.fn(), blocked: false }))

vi.mock('../git/runner', () => ({ ghExecFileAsync: mocks.ghExecFileAsync }))
vi.mock('./rate-limit', () => ({
  repositoryRateLimitGuard: () => ({ blocked: mocks.blocked }),
  noteRepositoryRateLimitSpend: vi.fn()
}))

import { isPullRequestInMergeQueue } from './pr-merge-queue-membership'

const repo = { owner: 'acme', repo: 'app' }

describe('isPullRequestInMergeQueue', () => {
  beforeEach(() => {
    mocks.ghExecFileAsync.mockReset()
    mocks.blocked = false
  })

  it("reads GitHub's answer", async () => {
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({
        data: { repository: { pullRequest: { isInMergeQueue: true } } }
      })
    })

    await expect(isPullRequestInMergeQueue(repo, 7, {})).resolves.toBe(true)
    expect(mocks.ghExecFileAsync.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(['owner=acme', 'repo=app', 'pr=7'])
    )
  })

  it('knows nothing when rate limited or GitHub fails', async () => {
    mocks.blocked = true
    await expect(isPullRequestInMergeQueue(repo, 7, {})).resolves.toBeUndefined()
    expect(mocks.ghExecFileAsync).not.toHaveBeenCalled()

    mocks.blocked = false
    mocks.ghExecFileAsync.mockRejectedValue(new Error('offline'))
    await expect(isPullRequestInMergeQueue(repo, 7, {})).resolves.toBeUndefined()
  })
})
