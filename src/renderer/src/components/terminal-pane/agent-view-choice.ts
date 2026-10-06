import { claudeWebView } from './claude-web-view-state'

export type AgentView = 'terminal' | 'chat' | 'claude-web'

// Why clear the web view first: it covers both other views, so leaving it up would switch only
// the layer underneath it and show nothing.
export function applyAgentViewChoice({
  next,
  tabId,
  claudeLeafId,
  isChat,
  onToggleChat
}: {
  next: AgentView
  tabId: string
  claudeLeafId: string | null
  isChat: boolean
  onToggleChat?: () => void
}): void {
  if (next === 'claude-web') {
    if (claudeLeafId) {
      claudeWebView.show(tabId, claudeLeafId, { focusPrompt: true })
    }
    return
  }
  claudeWebView.hide(tabId)
  if ((next === 'chat') !== isChat) {
    onToggleChat?.()
  }
}
