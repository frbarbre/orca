import { useEffect } from 'react'
import { useAppStore } from '../../store'

const CLOSE_OTHER_TABS_EVENT = 'orca-close-other-tabs'

type CloseOtherTabsDetail = { worktreeId: string }

// Fork: a shortcut has no tab under the pointer, so the focused group closes around its own active
// tab, through the same dirty-aware close the context menu's "Close Others" uses.
export function requestCloseOtherTabs(worktreeId: string): void {
  window.dispatchEvent(
    new CustomEvent<CloseOtherTabsDetail>(CLOSE_OTHER_TABS_EVENT, { detail: { worktreeId } })
  )
}

export function subscribeCloseOtherTabs(
  worktreeId: string,
  groupId: string,
  closeOthers: () => void
): () => void {
  const onRequest = (event: Event): void => {
    const detail = (event as CustomEvent<CloseOtherTabsDetail>).detail
    if (
      detail?.worktreeId === worktreeId &&
      useAppStore.getState().activeGroupIdByWorktree[worktreeId] === groupId
    ) {
      closeOthers()
    }
  }
  window.addEventListener(CLOSE_OTHER_TABS_EVENT, onRequest)
  return () => window.removeEventListener(CLOSE_OTHER_TABS_EVENT, onRequest)
}

export function useCloseOtherTabsRequest(
  worktreeId: string,
  groupId: string,
  activeItemId: string | null | undefined,
  closeOthers: (itemId: string) => void
): void {
  useEffect(() => {
    if (!activeItemId) {
      return
    }
    return subscribeCloseOtherTabs(worktreeId, groupId, () => closeOthers(activeItemId))
  }, [activeItemId, closeOthers, groupId, worktreeId])
}
