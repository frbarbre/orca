import type { Worktree } from '../../../../shared/worktree/types'

const TEMPORARY_CHECKOUT_PATH =
  /^(?:\/private)?\/(?:tmp|var\/folders)\/|[\\/]AppData[\\/]Local[\\/]Temp[\\/]/i

// Why: agents and scripts run `git worktree add` into temp folders, and git reports those checkouts as worktrees of the repo.
export function isTemporaryCheckoutWorkspace(
  worktree: Pick<Worktree, 'path' | 'isMainWorktree'>
): boolean {
  return !worktree.isMainWorktree && TEMPORARY_CHECKOUT_PATH.test(worktree.path)
}
