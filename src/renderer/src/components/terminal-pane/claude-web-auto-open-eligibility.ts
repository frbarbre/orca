type TabRow = { id: string; viewMode?: 'terminal' | 'chat' }
type TabsIndex = Readonly<Record<string, readonly TabRow[]>>

function hasChatTab(index: TabsIndex, tabId: string): boolean {
  return Object.values(index).some((tabs) =>
    tabs.some((tab) => tab.id === tabId && tab.viewMode === 'chat')
  )
}

// Fork: a tab put in Chat UI on purpose (the review agent) keeps it; the web view would cover it.
// Why both indices: a background launch's terminal row can lag behind its unified tab.
export function isTabInChatView(
  tabsByWorktree: TabsIndex,
  unifiedTabsByWorktree: TabsIndex,
  tabId: string
): boolean {
  return hasChatTab(tabsByWorktree, tabId) || hasChatTab(unifiedTabsByWorktree, tabId)
}
