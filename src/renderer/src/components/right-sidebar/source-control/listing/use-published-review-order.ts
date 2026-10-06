import { useEffect, useMemo } from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import {
  clearSourceControlReviewOrder,
  setSourceControlReviewOrder
} from '@/lib/source-control-review-order'
import type { SourceControlTreeNode } from '../../source-control-tree'
import type { FlatEntry } from './use-selection'

// Why: keyboard file-stepping must follow what the panel is showing — filtered, collapsed
// directories honoured, tree or list — so publish that order rather than let the step action
// re-derive it from the raw git arrays and land on a file the user cannot see next to the current one.
export function usePublishedSourceControlReviewOrder({
  activeWorktreeId,
  visibleSelectionEntries,
  visibleBranchTreeRows,
  filteredBranchEntries
}: {
  activeWorktreeId: string | null
  visibleSelectionEntries: readonly FlatEntry[]
  visibleBranchTreeRows: readonly SourceControlTreeNode<GitBranchChangeEntry, 'branch'>[]
  filteredBranchEntries: readonly GitBranchChangeEntry[]
}): void {
  const reviewOrder = useMemo(() => {
    const keys: string[] = []
    const seen = new Set<string>()
    // Why row keys (`<area>::<path>`) rather than paths: a file changed in the working tree AND on
    // the branch has a row in both sections, and deduping by path dropped the branch row from the
    // order entirely — stepping silently skipped it. The keys differ by area, so both survive.
    const push = (key: string): void => {
      if (seen.has(key)) {
        return
      }
      seen.add(key)
      keys.push(key)
    }
    for (const entry of visibleSelectionEntries) {
      push(entry.key)
    }
    for (const node of visibleBranchTreeRows) {
      if (node.type === 'file') {
        push(node.key)
      }
    }
    // Why: list mode renders branch entries flat instead of as tree rows.
    if (visibleBranchTreeRows.length === 0) {
      for (const entry of filteredBranchEntries) {
        push(`branch::${entry.path}`)
      }
    }
    return keys
  }, [filteredBranchEntries, visibleBranchTreeRows, visibleSelectionEntries])

  useEffect(() => {
    if (!activeWorktreeId) {
      return
    }
    setSourceControlReviewOrder(activeWorktreeId, reviewOrder)
    return () => clearSourceControlReviewOrder(activeWorktreeId)
  }, [activeWorktreeId, reviewOrder])
}
