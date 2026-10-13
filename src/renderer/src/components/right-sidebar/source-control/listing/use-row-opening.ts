import { useCallback, useMemo } from 'react'
import { detectLanguage } from '@/lib/language-detect'
import { joinPath } from '@/lib/path'
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
import { openChangesFilterEntry } from '@/store/slices/editor/actions/open-changes-filter-entry'
import { getChangesFilter } from '@/lib/changes-filter'
import {
  pickUncommittedRowEntry,
  useOpenDiffFollowsChangesFilter
} from './open-diff-follows-filter'
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
  const openBranchWorktreeDiff = useAppStore((s) => s.openBranchWorktreeDiff)
  const activeGroupIdByWorktree = useAppStore((s) => s.activeGroupIdByWorktree)
  const groupsByWorktree = useAppStore((s) => s.groupsByWorktree)
  const createEmptySplitGroup = useAppStore((s) => s.createEmptySplitGroup)
  const trackConflictPath = useAppStore((s) => s.trackConflictPath)
  const openConflictFile = useAppStore((s) => s.openConflictFile)
  const openDiff = useAppStore((s) => s.openDiff)
  const openFile = useAppStore((s) => s.openFile)
  const setEditorViewMode = useAppStore((s) => s.setEditorViewMode)
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)

  // Why: modifier-click keeps the current pane intact by opening the file in a fresh split to the right.
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

  // Why: a stable string signature keeps this selector referentially stable so the panel re-renders only when the active editor file changes; null when the tab isn't an editor.
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
      if (entry.conflictKind && entry.conflictStatus) {
        if (entry.conflictStatus === 'unresolved') {
          trackConflictPath(activeWorktreeId, entry.path, entry.conflictKind)
        }
        openConflictFile(activeWorktreeId, worktreePath, entry, detectLanguage(entry.path), {
          targetGroupId,
          preview: openAsPreview
        })
        return
      }
      const language = detectLanguage(entry.path)
      const filePath = joinPath(worktreePath, entry.path)
      // Why: unstaged markdown diffs open as an edit tab in Changes view (one tab per file); staged diffs still get a separate diff tab since that isn't what the editor edits.
      if (language === 'markdown' && entry.area === 'unstaged') {
        openFile(
          {
            filePath,
            relativePath: entry.path,
            worktreeId: activeWorktreeId,
            language,
            mode: 'edit'
          },
          { targetGroupId, preview: openAsPreview }
        )
        setEditorViewMode(filePath, 'changes')
        return
      }
      openDiff(activeWorktreeId, filePath, entry.path, language, entry.area === 'staged', {
        targetGroupId,
        preview: openAsPreview
      })
    },
    [
      activeWorktreeId,
      worktreePath,
      resolveSplitTargetGroupId,
      trackConflictPath,
      openConflictFile,
      openDiff,
      openFile,
      setEditorViewMode
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
      const filterTargetGroupId = resolveSplitTargetGroupId(event)
      if (
        openChangesFilterEntry(
          useAppStore.getState(),
          activeWorktreeId,
          worktreePath,
          entry.path,
          detectLanguage(entry.path),
          {
            targetGroupId: filterTargetGroupId,
            preview: shouldOpenSourceControlRowAsPreview(event, filterTargetGroupId)
          }
        )
      ) {
        return
      }
      const local = statusEntries.filter((candidate) => candidate.path === entry.path)
      // Why: a conflicted file opens its resolver, and with no base to compare against the plain
      // uncommitted diff is the closest view. Showing only uncommitted work opens that work too.
      const fallback =
        local.find((candidate) => candidate.conflictKind && candidate.conflictStatus) ??
        (getChangesFilter(activeWorktreeId)?.kind === 'uncommitted'
          ? pickUncommittedRowEntry(local)
          : undefined) ??
        (branchSummary?.status === 'ready' ? undefined : local[0])
      if (fallback) {
        handleOpenDiff(fallback, event)
        return
      }
      if (branchSummary?.status !== 'ready') {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openBranchWorktreeDiff(
        activeWorktreeId,
        worktreePath,
        entry,
        branchSummary,
        detectLanguage(entry.path),
        { targetGroupId, preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId) }
      )
    },
    [
      activeWorktreeId,
      branchSummary,
      handleOpenDiff,
      openBranchWorktreeDiff,
      resolveSplitTargetGroupId,
      statusEntries,
      worktreePath
    ]
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
