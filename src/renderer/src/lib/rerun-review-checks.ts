import { useAppStore } from '@/store'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import {
  getGitHubSourceTarget,
  getGitHubWorkItemRequestContext
} from '@/store/github/work-item-routing'
import type { Repo } from '../../../shared/repo-types'
import type { GitHubRerunPRChecksResult } from '../../../shared/github/check-types'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'

export async function rerunReviewChecks(args: {
  repo: Repo
  prNumber: number
  headSha?: string
  prRepo?: GitHubOwnerRepo | null
  failedOnly: boolean
}): Promise<GitHubRerunPRChecksResult> {
  const state = useAppStore.getState()
  const { target } = getGitHubWorkItemRequestContext(
    state,
    getGitHubSourceTarget(state, args.repo),
    args.repo.id,
    args.repo.path
  )
  if (target.kind === 'environment') {
    return callRuntimeRpc<GitHubRerunPRChecksResult>(
      { kind: 'environment', environmentId: target.environmentId },
      'github.rerunPRChecks',
      {
        repo: target.runtimeRepoId,
        prNumber: args.prNumber,
        headSha: args.headSha,
        failedOnly: args.failedOnly,
        prRepo: args.prRepo ?? null
      },
      { timeoutMs: 30_000 }
    )
  }
  return window.api.gh.rerunPRChecks({
    repoPath: args.repo.path,
    repoId: args.repo.id,
    prNumber: args.prNumber,
    headSha: args.headSha,
    failedOnly: args.failedOnly,
    prRepo: args.prRepo ?? null
  })
}
