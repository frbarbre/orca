import type { GitHubPRStackEntry } from '../../../../shared/github/pull-request-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { branchName } from '@/lib/git-utils'

type NavigationModifiers = { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }

export function openGitHubPRStackEntry(
  entry: Pick<GitHubPRStackEntry, 'number' | 'headRefName' | 'url'>,
  modifiers: NavigationModifiers,
  deps: {
    worktrees: readonly Worktree[]
    activateWorktree: (worktreeId: string) => void
    openUrl: (url: string, modifiers: NavigationModifiers) => void
  }
): void {
  // Why: a modifier click keeps its link meaning, so the PR stays reachable on GitHub.
  const worktree =
    modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey
      ? undefined
      : findStackEntryWorktree(deps.worktrees, entry)
  if (worktree) {
    deps.activateWorktree(worktree.id)
    return
  }
  deps.openUrl(entry.url, modifiers)
}

export function findStackEntryWorktree(
  worktrees: readonly Worktree[],
  entry: Pick<GitHubPRStackEntry, 'number' | 'headRefName'>
): Worktree | undefined {
  return (
    worktrees.find((worktree) => worktree.linkedPR === entry.number) ??
    (entry.headRefName
      ? worktrees.find((worktree) => branchName(worktree.branch) === entry.headRefName)
      : undefined)
  )
}
