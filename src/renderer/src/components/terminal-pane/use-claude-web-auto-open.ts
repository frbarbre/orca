import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { claudeWebView, findClaudeWebLeafId } from './claude-web-view-state'

const RENDERER_STARTED_AT = Date.now()
const autoOpenedPaneKeys = new Set<string>()

/**
 * With the "Claude web" default view on, a Claude Code session that starts in a tab created
 * during this run opens in the web view once. Restored tabs and panes the user switched back to
 * the terminal are left alone.
 */
export function useClaudeWebAutoOpen(tabId: string, shownLeafId: string | null): void {
  const enabled = useAppStore((state) => state.settings?.openClaudeTabsInWebView === true)
  const createdThisRun = useAppStore((state) =>
    Object.values(state.tabsByWorktree).some((tabs) =>
      tabs.some((tab) => tab.id === tabId && tab.createdAt >= RENDERER_STARTED_AT)
    )
  )
  const claudeLeafId = useAppStore((state) =>
    enabled && createdThisRun ? findClaudeWebLeafId(state, tabId) : null
  )

  useEffect(() => {
    if (!claudeLeafId || shownLeafId) {
      return
    }
    const paneKey = `${tabId}:${claudeLeafId}`
    if (autoOpenedPaneKeys.has(paneKey)) {
      return
    }
    autoOpenedPaneKeys.add(paneKey)
    claudeWebView.show(tabId, claudeLeafId)
  }, [claudeLeafId, shownLeafId, tabId])
}
