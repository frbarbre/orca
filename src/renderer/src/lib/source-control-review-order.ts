/**
 * The order the Source Control panel is currently showing its changed files in, per worktree.
 *
 * Why a module registry rather than store state: keyboard file-stepping has to walk exactly what the
 * user sees — which depends on the filter text, the collapsed directories and the tree/list mode —
 * and that projection is rebuilt on every filter keystroke. Publishing it through the store would
 * run every selector in the app on each of those rebuilds for a value no component renders. This is
 * written by the panel and read only imperatively, by the step action.
 *
 * The step action falls back to the raw git order when nothing is published, so stepping still works
 * with the panel closed — it just cannot honour a filter it cannot see.
 */
const orderByWorktree = new Map<string, readonly string[]>()

export function setSourceControlReviewOrder(worktreeId: string, paths: readonly string[]): void {
  orderByWorktree.set(worktreeId, paths)
}

export function getSourceControlReviewOrder(worktreeId: string): readonly string[] | null {
  return orderByWorktree.get(worktreeId) ?? null
}

export function clearSourceControlReviewOrder(worktreeId: string): void {
  orderByWorktree.delete(worktreeId)
}
