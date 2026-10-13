import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../shared/stable-pane-id'

const wokenTabIds = new Set<string>()
const wakeCountByPaneKey = new Map<string, number>()
let tracking = false

/** A pane whose sleeping record is cleared has had its agent resumed, whichever wake path did it. */
export function noteWokenPanes(
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>
): void {
  for (const paneKey of Object.keys(previous)) {
    if (!(paneKey in next)) {
      const tabId = parsePaneKey(paneKey)?.tabId
      if (tabId) {
        wokenTabIds.add(tabId)
        wakeCountByPaneKey.set(paneKey, paneWakeCount(paneKey) + 1)
      }
    }
  }
}

export function tabHasWokenPane(tabId: string): boolean {
  return wokenTabIds.has(tabId)
}

export function paneWakeCount(paneKey: string): number {
  return wakeCountByPaneKey.get(paneKey) ?? 0
}

// Fork: a session woken in place keeps its old tab, so "created this run" alone missed it.
export function ensureWokenPaneTracking(): void {
  if (tracking) {
    return
  }
  tracking = true
  useAppStore.subscribe((state, previous) => {
    if (state.sleepingAgentSessionsByPaneKey !== previous.sleepingAgentSessionsByPaneKey) {
      noteWokenPanes(previous.sleepingAgentSessionsByPaneKey, state.sleepingAgentSessionsByPaneKey)
    }
  })
}

export function resetWokenPanesForTests(): void {
  wokenTabIds.clear()
  wakeCountByPaneKey.clear()
}
