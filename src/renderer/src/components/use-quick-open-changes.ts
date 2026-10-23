import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useChangesFilter } from '@/lib/changes-filter'
import type { GitBranchChangeEntry } from '../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../shared/git-status-types'
import {
  buildScopedChangeEntries,
  selectBranchLineCounts
} from './right-sidebar/source-control/listing/scoped-change-entries'
import { useSourceControlFileScope } from './right-sidebar/source-control/listing/file-scope-store'

const NO_STATUS_ENTRIES: readonly GitStatusEntry[] = []
const NO_BRANCH_ENTRIES: readonly GitBranchChangeEntry[] = []

export function useQuickOpenChanges(
  worktreeId: string | null
): ReadonlyMap<string, GitBranchChangeEntry> {
  const statusEntries = useAppStore((s) =>
    worktreeId ? (s.gitStatusByWorktree[worktreeId] ?? NO_STATUS_ENTRIES) : NO_STATUS_ENTRIES
  )
  const branchEntries = useAppStore((s) =>
    worktreeId ? (s.gitBranchChangesByWorktree[worktreeId] ?? NO_BRANCH_ENTRIES) : NO_BRANCH_ENTRIES
  )
  const lineCounts = useAppStore((s) => selectBranchLineCounts(s, worktreeId))
  const changesFilter = useChangesFilter(worktreeId)
  const { hiddenCategories, reviewAttributes } = useSourceControlFileScope(worktreeId)
  return useMemo(
    () =>
      new Map(
        buildScopedChangeEntries({
          statusEntries,
          branchEntries,
          changesFilter,
          lineCounts,
          hiddenCategories,
          reviewAttributes
        }).map((entry) => [entry.path, entry])
      ),
    [branchEntries, changesFilter, hiddenCategories, lineCounts, reviewAttributes, statusEntries]
  )
}
