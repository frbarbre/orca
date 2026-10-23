import { useAppStore } from '@/store'
import type { GitBranchChangeEntry } from '../../../shared/git-diff-compare-types'
import type { QuickOpenQueryTarget } from '../../../shared/quick-open-query-target'
import { openSourceControlChangeEntry } from './right-sidebar/source-control/listing/open-change-entry'

export type QuickOpenTarget = { kind: 'diff'; entry: GitBranchChangeEntry } | { kind: 'file' }

// Why a line jump opens the file: only the editor can reveal the line.
export function resolveQuickOpenTarget(
  path: string,
  navigation: QuickOpenQueryTarget,
  changesByPath: ReadonlyMap<string, GitBranchChangeEntry>
): QuickOpenTarget {
  const entry = navigation.line === undefined ? changesByPath.get(path) : undefined
  return entry ? { kind: 'diff', entry } : { kind: 'file' }
}

export function openQuickOpenChange(
  worktreeId: string,
  worktreePath: string,
  entry: GitBranchChangeEntry
): void {
  const state = useAppStore.getState()
  openSourceControlChangeEntry({
    worktreeId,
    worktreePath,
    entry,
    statusEntries: state.gitStatusByWorktree[worktreeId] ?? [],
    branchSummary: state.gitBranchCompareSummaryByWorktree[worktreeId]
  })
}
