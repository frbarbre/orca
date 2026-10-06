import { Globe, SquareTerminal } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { claudeWebView, findClaudeWebLeafId, useClaudeWebViewLeafId } from './claude-web-view-state'

/** Toggles a Claude Code pane between its terminal and the claude.ai Remote Control page. */
export function ClaudeWebViewMenuItem({
  tabId,
  leafId
}: {
  tabId: string
  leafId?: string | null
}): React.JSX.Element | null {
  const shownLeafId = useClaudeWebViewLeafId(tabId)
  const claudeLeafId = useAppStore((state) => findClaudeWebLeafId(state, tabId, leafId))
  const isShown = shownLeafId !== null && (leafId == null || shownLeafId === leafId)

  if (!isShown && !claudeLeafId) {
    return null
  }
  return (
    <DropdownMenuItem
      onSelect={() =>
        isShown
          ? claudeWebView.hide(tabId)
          : claudeLeafId && claudeWebView.show(tabId, claudeLeafId)
      }
    >
      {isShown ? <SquareTerminal /> : <Globe />}
      {isShown
        ? translate(
            'components.tab.bar.SortableTabContextMenu.switchToTerminalView',
            'Switch to terminal view'
          )
        : translate(
            'auto.components.terminal.pane.ClaudeWebView.switchToWebView',
            'Switch to Claude web view'
          )}
    </DropdownMenuItem>
  )
}
