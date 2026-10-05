import type { Worktree } from '../../../../shared/worktree/types'
import { isTemporaryCheckoutWorkspace } from './visible-worktree-kinds'

/** Lifts "Hide temporary checkouts" when it is what hides the worktree being revealed. */
export function revealTemporaryCheckout(
  state: {
    hideTemporaryCheckoutWorkspaces: boolean
    setHideTemporaryCheckoutWorkspaces: (hide: boolean) => void
  },
  worktree: Pick<Worktree, 'path' | 'isMainWorktree'>
): void {
  if (state.hideTemporaryCheckoutWorkspaces && isTemporaryCheckoutWorkspace(worktree)) {
    state.setHideTemporaryCheckoutWorkspaces(false)
  }
}
