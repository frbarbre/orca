import { useAppStore } from '@/store'
import { activeWorktreeGitHubPullRequest } from '@/lib/worktree-pull-request-url'
import { openWorkspaceFrontendUrl } from '@/lib/open-workspace-frontend'

export async function openActivePullRequestPreview(): Promise<boolean> {
  const pullRequest = activeWorktreeGitHubPullRequest(useAppStore.getState())
  if (!pullRequest) {
    return false
  }
  const url = await window.api.gh.prPreviewUrl({
    repoPath: pullRequest.repoPath,
    repoId: pullRequest.repoId,
    prNumber: pullRequest.prNumber,
    prRepo: pullRequest.prRepo
  })
  if (!url) {
    return false
  }
  openWorkspaceFrontendUrl(pullRequest.worktreeId, url)
  return true
}
