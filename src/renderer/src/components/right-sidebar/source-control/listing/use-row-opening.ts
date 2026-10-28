import { useCallback, useMemo } from 'react'
import { detectLanguage } from '@/lib/language-detect'
import { openUncommittedEntry } from './open-uncommitted-entry'
import { useAppStore } from '@/store'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { buildActiveOpenFileSignature, buildActiveOpenRowKeys } from './active-open-file-keys'
import type { FlatEntry } from './use-selection'
import {
  isSourceControlSplitOpenModifier,
  shouldOpenSourceControlRowAsPreview,
  type SourceControlRowOpenEvent
} from './split-open'
import { buildAllChangesOpenRowKeys } from './all-changes'
import { useOpenDiffFollowsChangesFilter } from './open-diff-follows-filter'
import { openSourceControlChangeEntry } from './open-change-entry'
import type { useAllChangesProjection } from './use-all-changes-projection'

export function useSourceControlRowOpening({
  isMac,
  activeWorktreeId,
  worktreePath,
  visibleSelectionEntries,
  branchSummary,
  sourceControlGrouping,
  statusEntries,
  allChanges
}: {
  isMac: boolean
  activeWorktreeId: string | null
  worktreePath: string | null
  visibleSelectionEntries: FlatEntry[]
  branchSummary: GitBranchCompareSummary | null
  sourceControlGrouping: 'all' | 'status'
  statusEntries: readonly GitStatusEntry[]
  allChanges: Pick<ReturnType<typeof useAllChangesProjection>, 'changesFilter' | 'allChangeEntries'>
}) {
  const activeGroupIdByWorktree = useAppStore((s) => s.activeGroupIdByWorktree)
  const groupsByWorktree = useAppStore((s) => s.groupsByWorktree)
  const createEmptySplitGroup = useAppStore((s) => s.createEmptySplitGroup)
  const trackConflictPath = useAppStore((s) => s.trackConflictPath)
  const openConflictFile = useAppStore((s) => s.openConflictFile)
  const openDiff = useAppStore((s) => s.openDiff)
  const openFile = useAppStore((s) => s.openFile)
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)

  // Modifier-click opens a right split to preserve the current pane.
  const resolveSplitTargetGroupId = useCallback(
    (event?: SourceControlRowOpenEvent): string | undefined => {
      if (!event || !activeWorktreeId || !isSourceControlSplitOpenModifier(event, isMac)) {
        return undefined
      }
      const sourceGroupId =
        activeGroupIdByWorktree[activeWorktreeId] ?? groupsByWorktree[activeWorktreeId]?.[0]?.id
      if (!sourceGroupId) {
        return undefined
      }
      return createEmptySplitGroup(activeWorktreeId, sourceGroupId, 'right') ?? undefined
    },
    [activeGroupIdByWorktree, activeWorktreeId, createEmptySplitGroup, groupsByWorktree, isMac]
  )

  // Use a primitive signature so unrelated store writes do not rerender; return null for non-editor tabs.
  const activeOpenFileSignature = useAppStore((s) => {
    if (!activeWorktreeId || s.activeTabTypeByWorktree?.[activeWorktreeId] !== 'editor') {
      return null
    }
    const activeFileId = s.activeFileIdByWorktree?.[activeWorktreeId]
    if (!activeFileId) {
      return null
    }
    const activeFile = s.openFiles?.find(
      (file) => file.id === activeFileId && file.worktreeId === activeWorktreeId
    )
    return activeFile
      ? buildActiveOpenFileSignature(activeFile.diffSource, activeFile.relativePath)
      : null
  })
  const activeOpenAvailableRowKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of visibleSelectionEntries) {
      keys.add(entry.key)
    }
    return keys
  }, [visibleSelectionEntries])
  const activeOpenRowKeys = useMemo(
    () =>
      sourceControlGrouping === 'all'
        ? buildAllChangesOpenRowKeys(activeOpenFileSignature)
        : buildActiveOpenRowKeys(activeOpenFileSignature, activeOpenAvailableRowKeys),
    [activeOpenAvailableRowKeys, activeOpenFileSignature, sourceControlGrouping]
  )

  // Why: the scroll target is a single row, while the key set can hold both working-tree variants
  // of a path; the first surviving key is the one a row actually rendered for.
  const activeOpenRowKey = useMemo(() => {
    for (const key of activeOpenRowKeys) {
      return key
    }
    return null
  }, [activeOpenRowKeys])

  const handleOpenDiff = useCallback(
    (entry: GitStatusEntry, event?: SourceControlRowOpenEvent) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      const openAsPreview = shouldOpenSourceControlRowAsPreview(event, targetGroupId)
      openUncommittedEntry(
        { trackConflictPath, openConflictFile, openFile, openDiff },
        activeWorktreeId,
        worktreePath,
        entry,
        { targetGroupId, preview: openAsPreview }
      )
    },
    [
      activeWorktreeId,
      worktreePath,
      resolveSplitTargetGroupId,
      trackConflictPath,
      openConflictFile,
      openDiff,
      openFile
    ]
  )

  const openCommittedDiff = useCallback(
    (entry: GitBranchChangeEntry, event?: SourceControlRowOpenEvent) => {
      if (
        !activeWorktreeId ||
        !worktreePath ||
        !branchSummary ||
        branchSummary.status !== 'ready'
      ) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openBranchDiff(
        activeWorktreeId,
        worktreePath,
        entry,
        branchSummary,
        detectLanguage(entry.path),
        { targetGroupId, preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId) }
      )
    },
    [activeWorktreeId, branchSummary, openBranchDiff, resolveSplitTargetGroupId, worktreePath]
  )

  const openAllChangesEntry = useCallback(
    (entry: GitBranchChangeEntry, event?: SourceControlRowOpenEvent) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openSourceControlChangeEntry({
        worktreeId: activeWorktreeId,
        worktreePath,
        entry,
        statusEntries,
        branchSummary,
        targetGroupId,
        preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId)
      })
    },
    [activeWorktreeId, branchSummary, resolveSplitTargetGroupId, statusEntries, worktreePath]
  )

  useOpenDiffFollowsChangesFilter({
    activeWorktreeId,
    changesFilter: allChanges.changesFilter,
    allChangeEntries: allChanges.allChangeEntries,
    openAllChangesEntry
  })

  return {
    resolveSplitTargetGroupId,
    activeOpenRowKeys,
    activeOpenRowKey,
    handleOpenDiff,
    openCommittedDiff,
    openAllChangesEntry
  }
}
