import { useSyncExternalStore } from 'react'
import { makePaneKey, parsePaneKey } from '../../../../shared/stable-pane-id'
import { resolvePaneAgentSessionId, type PaneAgentSessionIdState } from './pane-agent-session-id'

let leafIdByTabId: Readonly<Record<string, string>> = {}
const listeners = new Set<() => void>()

function publish(next: Readonly<Record<string, string>>): void {
  leafIdByTabId = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Which pane of a terminal tab is showing the claude.ai page instead of the terminal. */
export const claudeWebView = {
  leafIdFor: (tabId: string): string | null => leafIdByTabId[tabId] ?? null,
  show: (tabId: string, leafId: string): void => publish({ ...leafIdByTabId, [tabId]: leafId }),
  hide: (tabId: string): void => {
    if (tabId in leafIdByTabId) {
      const { [tabId]: _removed, ...rest } = leafIdByTabId
      publish(rest)
    }
  }
}

export function useClaudeWebViewLeafId(tabId: string): string | null {
  return useSyncExternalStore(subscribe, () => claudeWebView.leafIdFor(tabId))
}

export function resolvePaneClaudeSessionId(
  state: PaneAgentSessionIdState,
  paneKey: string
): string | null {
  if (state.agentStatusByPaneKey[paneKey]?.agentType !== 'claude') {
    return null
  }
  return resolvePaneAgentSessionId(state, paneKey)
}

/** The leaf of `tabId` running a live Claude Code session, preferring `preferredLeafId`. */
export function findClaudeWebLeafId(
  state: PaneAgentSessionIdState,
  tabId: string,
  preferredLeafId?: string | null
): string | null {
  if (preferredLeafId) {
    return resolvePaneClaudeSessionId(state, makePaneKey(tabId, preferredLeafId))
      ? preferredLeafId
      : null
  }
  for (const paneKey of Object.keys(state.agentStatusByPaneKey)) {
    const parsed = parsePaneKey(paneKey)
    if (parsed?.tabId === tabId && resolvePaneClaudeSessionId(state, paneKey)) {
      return parsed.leafId
    }
  }
  return null
}
