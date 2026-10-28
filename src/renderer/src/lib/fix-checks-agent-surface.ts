import { activateAndRevealWorktree } from '@/lib/worktree-activation'

/** Fork: a background launch opens the agent's tab without revealing its workspace or focusing it. */
export function fixChecksAgentSurface(
  worktreeId: string,
  background: boolean | undefined,
  onRevealFailed: () => void
): { activate: false } | { beforeSurfaceOpen: () => boolean } {
  if (background) {
    return { activate: false }
  }
  return {
    beforeSurfaceOpen: () => {
      // Why: the launcher owns the initial surface, so revealing must not seed a sibling shell.
      const revealed = activateAndRevealWorktree(worktreeId, { providesInitialSurface: true })
      if (revealed === false) {
        onRevealFailed()
      }
      return revealed !== false
    }
  }
}
