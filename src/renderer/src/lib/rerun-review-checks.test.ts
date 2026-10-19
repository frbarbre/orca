import { afterEach, describe, expect, it, vi } from 'vitest'

const callRuntimeRpc = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc }))

const requestTarget = vi.hoisted(() => ({ current: { kind: 'local' } as Record<string, string> }))
vi.mock('@/store/github/work-item-routing', () => ({
  getGitHubSourceTarget: () => ({ kind: 'local' }),
  getGitHubWorkItemRequestContext: () => ({ target: requestTarget.current })
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))

import { rerunReviewChecks } from './rerun-review-checks'

const repo = { id: 'repo-1', path: '/code/app' } as never
const prRepo = { owner: 'acme', repo: 'app' }

afterEach(() => {
  vi.unstubAllGlobals()
  callRuntimeRpc.mockReset()
})

describe('rerunReviewChecks', () => {
  it("asks this machine's gh to rerun the pull request's checks", async () => {
    const rerunPRChecks = vi.fn(async () => ({ ok: true as const, count: 2 }))
    vi.stubGlobal('window', { api: { gh: { rerunPRChecks } } })
    requestTarget.current = { kind: 'local' }

    const result = await rerunReviewChecks({
      repo,
      prNumber: 7,
      headSha: 'abc',
      prRepo,
      failedOnly: true
    })

    expect(result).toEqual({ ok: true, count: 2 })
    expect(rerunPRChecks).toHaveBeenCalledWith({
      repoPath: '/code/app',
      repoId: 'repo-1',
      prNumber: 7,
      headSha: 'abc',
      failedOnly: true,
      prRepo
    })
  })

  it('asks the remote host when the repository lives there', async () => {
    callRuntimeRpc.mockResolvedValue({ ok: true, count: 1 })
    requestTarget.current = {
      kind: 'environment',
      environmentId: 'env-1',
      runtimeRepoId: 'remote-repo'
    }

    await rerunReviewChecks({ repo, prNumber: 7, failedOnly: false })

    expect(callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'github.rerunPRChecks',
      { repo: 'remote-repo', prNumber: 7, headSha: undefined, failedOnly: false, prRepo: null },
      { timeoutMs: 30_000 }
    )
  })
})
