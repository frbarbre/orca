import { useCallback } from 'react'
import { useAppStore } from '../../store'
import { captureWorkspaceEmptiedReaction } from './workspace-emptied-reaction'
import { isEditorTabContentType } from '@/store/slices/editor/tabs/editor-tab-content-type'
import {
  useBulkTabCloseConfirmation,
  type BulkTabCloseScope
} from '../use-bulk-tab-close-confirmation'

export function useTabGroupCloseScopeCommands({
  groupId,
  worktreeId,
  closeItem,
  closeMany
}: {
  groupId: string
  worktreeId: string
  closeItem: (itemId: string, opts?: { skipEmptyCheck?: boolean }) => void
  closeMany: (itemIds: string[]) => void
}) {
  const closeEmptyGroup = useAppStore((state) => state.closeEmptyGroup)
  const confirmBulkClose = useBulkTabCloseConfirmation()
  const selectTabIds = useCallback(
    (scope: BulkTabCloseScope, itemId?: string): string[] => {
      const state = useAppStore.getState()
      const group = (state.groupsByWorktree[worktreeId] ?? []).find(
        (candidate) => candidate.id === groupId
      )
      if (!group) {
        return []
      }
      const tabs = (state.unifiedTabsByWorktree[worktreeId] ?? []).filter(
        (tab) => tab.groupId === groupId
      )
      if (scope === 'editors') {
        return tabs
          .filter((tab) => isEditorTabContentType(tab.contentType) && !tab.isPinned)
          .map((tab) => tab.id)
      }
      if (itemId === undefined || !tabs.some((tab) => tab.id === itemId)) {
        return []
      }
      if (scope === 'others') {
        return tabs.filter((tab) => tab.id !== itemId && !tab.isPinned).map((tab) => tab.id)
      }
      const index = group.tabOrder.indexOf(itemId)
      if (index === -1) {
        return []
      }
      const order =
        scope === 'right' ? group.tabOrder.slice(index + 1) : group.tabOrder.slice(0, index)
      const closableIds = new Set(tabs.filter((tab) => !tab.isPinned).map((tab) => tab.id))
      return order.filter((id) => closableIds.has(id))
    },
    [groupId, worktreeId]
  )

  const closeGroup = useCallback(() => {
    const whenEmptied = captureWorkspaceEmptiedReaction(worktreeId)
    const items = [...(useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? [])].filter(
      (item) => item.groupId === groupId
    )
    for (const item of items) {
      closeItem(item.id, { skipEmptyCheck: true })
    }
    // Why: closing tabs doesn't remove the group shell; empty split groups are layout state, collapse the placeholder pane here.
    closeEmptyGroup(worktreeId, groupId)
    whenEmptied()
  }, [closeEmptyGroup, closeItem, groupId, worktreeId])

  const closeAllEditorTabsInGroup = useCallback(() => {
    confirmBulkClose(
      'editors',
      () => selectTabIds('editors'),
      (ids) => {
        for (const id of ids) {
          closeItem(id)
        }
      }
    )
  }, [closeItem, confirmBulkClose, selectTabIds])

  const closeOthers = useCallback(
    (itemId: string, keep?: ReadonlySet<string>) => {
      // Why: store closeOtherTabs strands dirty files if the save dialog is cancelled; route via closeMany to stay dirty-aware.
      // Why: the fork's close-others chord passes `keep` and closes the other groups unprompted, so it skips the dialog too.
      if (keep) {
        closeMany(selectTabIds('others', itemId).filter((id) => !keep.has(id)))
        return
      }
      confirmBulkClose('others', () => selectTabIds('others', itemId), closeMany)
    },
    [closeMany, confirmBulkClose, selectTabIds]
  )

  const closeInDirection = useCallback(
    (itemId: string, direction: 'left' | 'right') => {
      confirmBulkClose(direction, () => selectTabIds(direction, itemId), closeMany)
    },
    [closeMany, confirmBulkClose, selectTabIds]
  )

  const closeToRight = useCallback(
    (itemId: string) => closeInDirection(itemId, 'right'),
    [closeInDirection]
  )
  const closeToLeft = useCallback(
    (itemId: string) => closeInDirection(itemId, 'left'),
    [closeInDirection]
  )

  const closeAllUnpinned = useCallback(
    (keep?: ReadonlySet<string>) => {
      closeMany(
        (useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? [])
          .filter(
            (candidate) =>
              candidate.groupId === groupId && !candidate.isPinned && !keep?.has(candidate.id)
          )
          .map((candidate) => candidate.id)
      )
      // Why: an emptied split is layout state; collapse it like closeGroup does. No-op if tabs remain.
      closeEmptyGroup(worktreeId, groupId)
    },
    [closeEmptyGroup, closeMany, groupId, worktreeId]
  )

  return {
    closeGroup,
    closeAllEditorTabsInGroup,
    closeAllUnpinned,
    closeOthers,
    closeToRight,
    closeToLeft
  }
}
