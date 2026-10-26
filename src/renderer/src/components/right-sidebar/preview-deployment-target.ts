import type { AppState } from '@/store/types'
import { prCommentsCacheSuffix } from '@/store/github/cache-identity'
import { getGitHubRepoCacheKey } from '../../../../shared/github/github-cache-key'
import { selectWorkspaceActionContext } from './workspace-actions/workspace-action-context'

export function selectPreviewTarget(state: AppState) {
  const context = selectWorkspaceActionContext(state)
  const pr = context?.pr
  if (!context || !pr) {
    return null
  }
  const { repo } = context
  return {
    repoPath: repo.path,
    repoId: repo.id,
    prNumber: pr.number,
    prRepo: pr.prRepo,
    headSha: pr.headSha,
    commentsCacheKey: getGitHubRepoCacheKey(
      repo.path,
      repo.id,
      prCommentsCacheSuffix(pr.number, pr.prRepo),
      state.settings,
      repo.connectionId,
      repo.executionHostId,
      true
    )
  }
}
