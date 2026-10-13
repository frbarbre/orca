import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { claudeWebView, findClaudeWebLeafId } from './claude-web-view-state'
import { ensureWokenPaneTracking, paneWakeCount, tabHasWokenPane } from './claude-web-woken-panes'
import { isTabInChatView } from './claude-web-auto-open-eligibility'

const RENDERER_STARTED_AT = Date.now()
const autoOpenedPaneKeys = new Set<string>()

/**
 * With the "Claude web" default view on, a Claude Code session that starts in a tab created
 * during this run, or is woken from sleep in its old tab, opens in the web view once. Other
 * restored tabs and panes the user switched back to the terminal are left alone.
 */
export function useClaudeWebAutoOpen(tabId: string, shownLeafId: string | null): void {
  ensureWokenPaneTracking()
  const enabled = useAppStore((state) => state.settings?.openClaudeTabsInWebView === true)
  const createdThisRun = useAppStore(
    (state) =>
      tabHasWokenPane(tabId) ||
      Object.values(state.tabsByWorktree).some((tabs) =>
        tabs.some((tab) => tab.id === tabId && tab.createdAt >= RENDERER_STARTED_AT)
      )
  )
  const claudeLeafId = useAppStore((state) =>
    enabled && createdThisRun && !isTabInChatView(state.tabsByWorktree, tabId)
      ? findClaudeWebLeafId(state, tabId)
      : null
  )
  // Why the wake count in the key: each wake is a new session start, so it gets its own one open.
  const wakeCount = useAppStore(() =>
    claudeLeafId ? paneWakeCount(`${tabId}:${claudeLeafId}`) : 0
  )

  useEffect(() => {
    if (!claudeLeafId || shownLeafId) {
      return
    }
    const openKey = `${tabId}:${claudeLeafId}#${wakeCount}`
    if (autoOpenedPaneKeys.has(openKey)) {
      return
    }
    autoOpenedPaneKeys.add(openKey)
    claudeWebView.show(tabId, claudeLeafId, { focusPrompt: true })
  }, [claudeLeafId, shownLeafId, tabId, wakeCount])
}
