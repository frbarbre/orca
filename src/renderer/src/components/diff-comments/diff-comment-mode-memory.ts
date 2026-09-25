import type { DiffCommentMode } from './DiffCommentPopover'

/**
 * The comment destination last chosen in a worktree.
 *
 * Why it is remembered at all: reviewing a colleague's pull request means opening file after file
 * and leaving a comment on each. A destination that resets would put the reviewer one click from
 * posting an agent note to GitHub, or a review comment into a local scratch file, on every line.
 *
 * Why per worktree rather than globally: one worktree is a review of someone else's branch while
 * another is your own work in progress, and they want opposite defaults.
 *
 * Why a module registry rather than store state: the popover mounts and unmounts with every open,
 * so this has to outlive it, but nothing renders from it -- it is read once when a popover opens.
 */
const modeByWorktree = new Map<string, DiffCommentMode>()

export function getDiffCommentMode(worktreeId: string | null): DiffCommentMode {
  if (!worktreeId) {
    return 'note'
  }
  return modeByWorktree.get(worktreeId) ?? 'note'
}

export function setDiffCommentMode(worktreeId: string | null, mode: DiffCommentMode): void {
  if (!worktreeId) {
    return
  }
  modeByWorktree.set(worktreeId, mode)
}

export function clearDiffCommentMode(worktreeId: string): void {
  modeByWorktree.delete(worktreeId)
}
