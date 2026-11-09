import type { GitBranchLineTotal } from '../../../../shared/git-status-types'
import type { WorktreeCardPrDisplay } from './worktree-card-pr-display'

export type WorktreeCardDiff = {
  additions: number
  deletions: number
  source: 'local' | 'github'
}

export function resolveWorktreeCardDiff(
  localTotal: GitBranchLineTotal | undefined,
  prDisplay: WorktreeCardPrDisplay | null | undefined
): WorktreeCardDiff | undefined {
  if (localTotal) {
    return { additions: localTotal.added, deletions: localTotal.removed, source: 'local' }
  }
  const pr = prDisplay && 'additions' in prDisplay ? prDisplay : undefined
  return typeof pr?.additions === 'number' && typeof pr.deletions === 'number'
    ? { additions: pr.additions, deletions: pr.deletions, source: 'github' }
    : undefined
}
