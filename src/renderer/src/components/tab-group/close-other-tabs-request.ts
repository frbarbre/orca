import { useEffect } from 'react'
import { useAppStore } from '../../store'

const CLOSE_OTHER_TABS_EVENT = 'orca-close-other-tabs'

type CloseOtherTabsDetail = { worktreeId: string }

type CloseOtherTabsHandlers = {
  /** The focused group: close everything but its active tab. */
  keepActive: () => void
  /** Every other group of the workspace: close all of its tabs. */
  closeAll: () => void
}

// Fork: a shortcut has no tab under the pointer, so it keeps the active tab of the focused group
// and clears every other split, each group through its own dirty-aware close (pinned tabs stay).
export function requestCloseOtherTabs(worktreeId: string): void {
  window.dispatchEvent(
    new CustomEvent<CloseOtherTabsDetail>(CLOSE_OTHER_TABS_EVENT, { detail: { worktreeId } })
  )
}

export function subscribeCloseOtherTabs(
  worktreeId: string,
  groupId: string,
  handlers: CloseOtherTabsHandlers
): () => void {
  const onRequest = (event: Event): void => {
    const detail = (event as CustomEvent<CloseOtherTabsDetail>).detail
    if (detail?.worktreeId !== worktreeId) {
      return
    }
    if (useAppStore.getState().activeGroupIdByWorktree[worktreeId] === groupId) {
      handlers.keepActive()
    } else {
      handlers.closeAll()
    }
  }
  window.addEventListener(CLOSE_OTHER_TABS_EVENT, onRequest)
  return () => window.removeEventListener(CLOSE_OTHER_TABS_EVENT, onRequest)
}

export function useCloseOtherTabsRequest(
  worktreeId: string,
  groupId: string,
  model: {
    activeTab?: { id: string } | null
    commands: { closeOthers: (itemId: string) => void; closeAllUnpinned: () => void }
  }
): void {
  const activeItemId = model.activeTab?.id
  const { closeOthers, closeAllUnpinned } = model.commands
  useEffect(
    () =>
      subscribeCloseOtherTabs(worktreeId, groupId, {
        keepActive: () => {
          if (activeItemId) {
            closeOthers(activeItemId)
          }
        },
        closeAll: closeAllUnpinned
      }),
    [activeItemId, closeAllUnpinned, closeOthers, groupId, worktreeId]
  )
}
