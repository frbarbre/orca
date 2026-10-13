import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import type { ChangesFilter } from '@/lib/changes-filter'
import type { OpenFile } from '@/store/slices/editor/types/open-file'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'

export function changesFilterKey(filter: ChangesFilter | null): string {
  if (!filter) {
    return 'all'
  }
  return filter.kind === 'uncommitted'
    ? 'uncommitted'
    : `${filter.kind}:${filter.compare.commitOid}`
}

export function findFollowEntry(
  file: Pick<OpenFile, 'mode' | 'isDirty' | 'worktreeId' | 'relativePath'> | undefined,
  worktreeId: string,
  entries: readonly GitBranchChangeEntry[]
): GitBranchChangeEntry | null {
  // Why not a dirty tab: replacing it would drop the unsaved edits.
  if (!file || file.mode !== 'diff' || file.isDirty || file.worktreeId !== worktreeId) {
    return null
  }
  return entries.find((entry) => entry.path === file.relativePath) ?? null
}

const UNCOMMITTED_AREA_ORDER: readonly GitStatusEntry['area'][] = [
  'unstaged',
  'untracked',
  'staged'
]

export function pickUncommittedRowEntry(
  local: readonly GitStatusEntry[]
): GitStatusEntry | undefined {
  for (const area of UNCOMMITTED_AREA_ORDER) {
    const match = local.find((entry) => entry.area === area)
    if (match) {
      return match
    }
  }
  return undefined
}

// Fork: the open diff is the row as the new filter shows it, so it reopens the way clicking that
// row would, in place of the old tab.
export function useOpenDiffFollowsChangesFilter({
  activeWorktreeId,
  changesFilter,
  allChangeEntries,
  openAllChangesEntry
}: {
  activeWorktreeId: string | null
  changesFilter: ChangesFilter | null
  allChangeEntries: readonly GitBranchChangeEntry[]
  openAllChangesEntry: (entry: GitBranchChangeEntry) => void
}): void {
  const key = changesFilterKey(changesFilter)
  const previous = useRef<{ worktreeId: string | null; key: string } | null>(null)
  useEffect(() => {
    const last = previous.current
    previous.current = { worktreeId: activeWorktreeId, key }
    if (!activeWorktreeId || !last || last.worktreeId !== activeWorktreeId || last.key === key) {
      return
    }
    const state = useAppStore.getState()
    const fileId = state.activeFileIdByWorktree[activeWorktreeId]
    const file = state.openFiles.find((candidate) => candidate.id === fileId)
    const entry = findFollowEntry(file, activeWorktreeId, allChangeEntries)
    if (!file || !entry) {
      return
    }
    openAllChangesEntry(entry)
    const nextId = useAppStore.getState().activeFileIdByWorktree[activeWorktreeId]
    if (nextId && nextId !== file.id) {
      useAppStore.getState().closeFile(file.id)
    }
  }, [activeWorktreeId, allChangeEntries, key, openAllChangesEntry])
}
