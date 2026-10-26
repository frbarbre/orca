import { useAppStore } from '@/store'
import { findLatestPreviewDeployment } from '@/lib/preview-deployment'
import { selectPreviewTarget } from '@/components/right-sidebar/preview-deployment-target'

export async function openActivePullRequestPreview(): Promise<boolean> {
  const target = selectPreviewTarget(useAppStore.getState())
  if (!target) {
    return false
  }
  const cachedComments = (): Parameters<typeof findLatestPreviewDeployment>[0] | undefined =>
    useAppStore.getState().commentsCache[target.commentsCacheKey]?.data
  if (!cachedComments()) {
    await useAppStore
      .getState()
      .fetchPRComments(target.repoPath, target.prNumber, {
        repoId: target.repoId,
        prRepo: target.prRepo
      })
      .catch(() => {})
  }
  const comments = cachedComments()
  const deployment = comments ? findLatestPreviewDeployment(comments) : null
  if (!deployment) {
    return false
  }
  void window.api.shell.openUrl(deployment.url)
  return true
}
