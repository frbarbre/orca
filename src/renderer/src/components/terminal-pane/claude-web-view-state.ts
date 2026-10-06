import { useSyncExternalStore } from 'react'
import { makePaneKey, parsePaneKey } from '../../../../shared/stable-pane-id'
import { resolvePaneAgentSessionId, type PaneAgentSessionIdState } from './pane-agent-session-id'

const STORAGE_KEY = 'orca.claudeWebView.leafIdByTabId'

function readPersisted(): Readonly<Record<string, string>> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  } catch {
    return {}
  }
}

function writePersisted(value: Readonly<Record<string, string>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Why: storage can be unavailable; the view then just isn't remembered across reloads.
  }
}

let leafIdByTabId: Readonly<Record<string, string>> = readPersisted()
const listeners = new Set<() => void>()

function publish(next: Readonly<Record<string, string>>): void {
  leafIdByTabId = next
  writePersisted(next)
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
  // Why the sleeping record too: after a reload the live row can lag behind the restored session.
  const agent =
    state.agentStatusByPaneKey[paneKey]?.agentType ??
    state.sleepingAgentSessionsByPaneKey[paneKey]?.agent
  if (agent !== 'claude') {
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
