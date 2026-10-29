import type { AppState } from '@/store/types'
import type { Repo } from '../../../../../../shared/repo-types'
import type { GitHubPRStack } from '../../../../../../shared/github/pull-request-types'
import type { WorkspaceStatus } from '../../../../../../shared/worktree/types'
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

/** The status the status rules give someone else's pull request, which Stack grouping lists apart. */
export function selectStackReviewingStatus(
  state: Pick<AppState, 'workspaceStatusRules'>
): WorkspaceStatus | null {
  const rules = state.workspaceStatusRules
  return rules.enabled ? (rules.statusByCondition.reviewing ?? null) : null
}

/** The stack lane reader the shared builder takes, bound to the window's PR cache. */
export function createSidebarStackReader(
  repoMap: Map<string, Repo>,
  prCache: PRCacheView | null,
  reviewingStatus: WorkspaceStatus | null = null
): SidebarStackReader {
  return (worktree) => {
    if (reviewingStatus && worktree.workspaceStatus === reviewingStatus) {
      return 'reviewing'
    }
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
