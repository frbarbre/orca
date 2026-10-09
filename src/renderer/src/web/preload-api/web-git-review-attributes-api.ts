import type { PreloadApi } from '../../../../preload/api-types'
import { toRuntimeWorktreeSelector } from '../../runtime/runtime-worktree-selector'
import { callRuntimeResult } from './web-runtime-calls'
import { resolveRuntimeWorktreeByPath } from './web-runtime-worktree-catalog'

/** Fork: the changed-file type filter's attribute lookup, over the paired runtime. */
export function createWebGitReviewAttributesApi(): Pick<
  PreloadApi['git'],
  'checkReviewAttributes'
> {
  return {
    checkReviewAttributes: async ({ worktreePath, paths }) => {
      const worktree = await resolveRuntimeWorktreeByPath(worktreePath)
      return callRuntimeResult('git.checkReviewAttributes', {
        worktree: toRuntimeWorktreeSelector(worktree.id),
        paths
      })
    }
  }
}
