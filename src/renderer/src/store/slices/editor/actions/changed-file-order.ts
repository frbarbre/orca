import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'

export type ChangedFileStepDirection = 'next' | 'previous'

/**
 * The review order of a worktree's changed files: working-tree changes first, then the
 * branch-compare entries the working tree does not already carry.
 *
 * Why: mirrors the top-to-bottom order of the source-control panel, so stepping with the keyboard
 * walks the same sequence the user sees. Duplicates are dropped because a path can appear in both
 * lists (modified locally and changed on the branch) and must not be visited twice.
 */
export function buildChangedFileOrder(
  statusEntries: readonly GitStatusEntry[],
  branchEntries: readonly GitBranchChangeEntry[]
): string[] {
  const order: string[] = []
  const seen = new Set<string>()
  for (const entry of statusEntries) {
    if (seen.has(entry.path)) {
      continue
    }
    seen.add(entry.path)
    order.push(entry.path)
  }
  for (const entry of branchEntries) {
    if (seen.has(entry.path)) {
      continue
    }
    seen.add(entry.path)
    order.push(entry.path)
  }
  return order
}

/**
 * The path one step from `currentPath`, or `null` when there is nowhere to go.
 *
 * Why: wraps at both ends so a reviewer holding the shortcut cycles the change set instead of
 * silently stalling on the last file. An unknown `currentPath` (the open tab is not a changed file)
 * enters the list at its first entry going forward, last going back.
 */
export function stepChangedFile(
  order: readonly string[],
  currentPath: string | null,
  direction: ChangedFileStepDirection
): string | null {
  if (order.length === 0) {
    return null
  }
  const currentIndex = currentPath === null ? -1 : order.indexOf(currentPath)
  if (currentIndex === -1) {
    return direction === 'next' ? order[0] : (order.at(-1) ?? null)
  }
  if (order.length === 1) {
    return null
  }
  const delta = direction === 'next' ? 1 : -1
  const nextIndex = (currentIndex + delta + order.length) % order.length
  return order[nextIndex]
}
