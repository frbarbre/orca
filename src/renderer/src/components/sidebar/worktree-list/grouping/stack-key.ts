import type { Repo } from '../../../../../../shared/repo-types'
import type { GitHubPRStack } from '../../../../../../shared/github/pull-request-types'
import type { SidebarStackReader } from '../../../../../../shared/sidebar-list/stack-groups'
import {
  readWorkspaceReviewPR,
  type PRCacheView
} from '../../../../../../shared/sidebar-list/workspace-review-facts'

type StackedPR = {
  number?: number
  state?: string
  stack?: Pick<GitHubPRStack, 'number' | 'position'>
}

/** The stack lane reader the shared builder takes, bound to the window's PR cache. */
export function createSidebarStackReader(
  repoMap: Map<string, Repo>,
  prCache: PRCacheView | null
): SidebarStackReader {
  return (worktree) => {
    if (!prCache) {
      return null
    }
    const pr = readWorkspaceReviewPR<StackedPR>(
      worktree,
      repoMap.get(worktree.repoId),
      prCache as PRCacheView<StackedPR>
    )
    return pr?.stack ? { number: pr.stack.number, position: pr.stack.position } : null
  }
}
