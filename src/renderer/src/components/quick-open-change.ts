import { useAppStore } from '@/store'
import type { GitBranchChangeEntry } from '../../../shared/git-diff-compare-types'
import type { QuickOpenQueryTarget } from '../../../shared/quick-open-query-target'
import { openSourceControlChangeEntry } from './right-sidebar/source-control/listing/open-change-entry'

export type QuickOpenDiffTarget = {
  kind: 'diff'
  entry: GitBranchChangeEntry
  line?: number
  column?: number
}
export type QuickOpenTarget = QuickOpenDiffTarget | { kind: 'file' }

export function resolveQuickOpenTarget(
  path: string,
  navigation: QuickOpenQueryTarget,
  changesByPath: ReadonlyMap<string, GitBranchChangeEntry>
): QuickOpenTarget {
  const entry = changesByPath.get(path)
  if (!entry) {
    return { kind: 'file' }
  }
  return navigation.line === undefined
    ? { kind: 'diff', entry }
    : { kind: 'diff', entry, line: navigation.line, column: navigation.column ?? 1 }
}

export function openQuickOpenChange(
  worktreeId: string,
  worktreePath: string,
  target: QuickOpenDiffTarget,
  matchLength = 0
): void {
  const state = useAppStore.getState()
  openSourceControlChangeEntry({
    worktreeId,
    worktreePath,
    entry: target.entry,
    statusEntries: state.gitStatusByWorktree[worktreeId] ?? [],
    branchSummary: state.gitBranchCompareSummaryByWorktree[worktreeId],
    ...(target.line === undefined
      ? {}
      : { reveal: { line: target.line, column: target.column ?? 1, matchLength } })
  })
}
