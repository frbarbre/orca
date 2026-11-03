import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  detectRepositoryMergeMetadata: vi.fn(),
  isPullRequestInMergeQueue: vi.fn()
}))

vi.mock('./../detect/repository-merge-metadata', () => ({
  detectRepositoryMergeMetadata: mocks.detectRepositoryMergeMetadata
}))
vi.mock('../../pr-merge-queue-membership', () => ({
  isPullRequestInMergeQueue: mocks.isPullRequestInMergeQueue
}))

import { hydratePullRequestLookupData } from './pull-request-lookup-hydration'
import type { PullRequestLookupData } from './pull-request-lookup-data'

const repo = { owner: 'acme', repo: 'app' }
const data: PullRequestLookupData = {
  number: 7,
  title: 'Ship it',
  state: 'OPEN',
  url: 'https://github.com/acme/app/pull/7',
  statusCheckRollup: [],
  updatedAt: '2026-11-03T00:00:00Z',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  baseRefName: 'main'
}

describe('hydratePullRequestLookupData', () => {
  beforeEach(() => {
    mocks.detectRepositoryMergeMetadata.mockReset()
    mocks.isPullRequestInMergeQueue.mockReset()
    mocks.isPullRequestInMergeQueue.mockResolvedValue(true)
  })

  it('asks whether the merge queue holds the pull request when its base uses one', async () => {
    mocks.detectRepositoryMergeMetadata.mockResolvedValue({
      mergeQueueRequired: true,
      autoMergeAllowed: true
    })

    const hydrated = await hydratePullRequestLookupData(repo, data, {}, 'scope')

    expect(mocks.isPullRequestInMergeQueue).toHaveBeenCalledWith(repo, 7, {})
    expect(hydrated.inMergeQueue).toBe(true)
  })

  it('spends no query on a base branch without a merge queue', async () => {
    mocks.detectRepositoryMergeMetadata.mockResolvedValue({
      mergeQueueRequired: false,
      autoMergeAllowed: true
    })

    const hydrated = await hydratePullRequestLookupData(repo, data, {}, 'scope')

    expect(mocks.isPullRequestInMergeQueue).not.toHaveBeenCalled()
    expect(hydrated).not.toHaveProperty('inMergeQueue')
  })
})
