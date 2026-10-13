type TerminalTabRow = { id: string; viewMode?: 'terminal' | 'chat' }

// Fork: a tab put in Chat UI on purpose (the review agent) keeps it; the web view would cover it.
export function isTabInChatView(
  tabsByWorktree: Readonly<Record<string, readonly TerminalTabRow[]>>,
  tabId: string
): boolean {
  return Object.values(tabsByWorktree).some((tabs) =>
    tabs.some((tab) => tab.id === tabId && tab.viewMode === 'chat')
  )
}
