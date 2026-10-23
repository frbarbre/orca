import { useCallback, useMemo } from 'react'
import { openWorkspaceFile } from '@/lib/workspace-file-open'
import { useAppStore } from '@/store'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { getActiveOpenFileSignature, buildActiveOpenRowKeys } from './active-open-file-keys'
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

  const activeOpenFileSignature = useAppStore((s) =>
    getActiveOpenFileSignature(s, activeWorktreeId, worktreePath)
  )
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

  const openUncommittedFile = useCallback(
    (entry: GitStatusEntry, event?: SourceControlRowOpenEvent) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openWorkspaceFile({
        kind: 'uncommitted',
        worktreeId: activeWorktreeId,
        worktreePath,
        entry,
        options: {
          targetGroupId,
          preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId)
        }
      })
    },
    [activeWorktreeId, worktreePath, resolveSplitTargetGroupId]
  )

  const openBranchFile = useCallback(
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
      openWorkspaceFile({
        kind: 'branch',
        worktreeId: activeWorktreeId,
        worktreePath,
        entry,
        compare: branchSummary,
        options: {
          targetGroupId,
          preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId)
        }
      })
    },
    [activeWorktreeId, branchSummary, resolveSplitTargetGroupId, worktreePath]
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
    openUncommittedFile,
    openBranchFile,
    openAllChangesEntry
  }
}
