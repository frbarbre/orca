import React from 'react'
import { SquareTerminal } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuShortcut } from '@/components/ui/dropdown-menu'
import { AgentViewSubmenu } from '@/components/terminal-pane/AgentViewSubmenu'
import { translate } from '@/i18n/i18n'

/** Fork: with the pane known, the View submenu (terminal / chat / Claude web) replaces the single switch. */
export function NativeChatSwitchViewMenuItem({
  onSwitchToTerminal,
  agentView,
  shortcutLabel
}: {
  onSwitchToTerminal?: () => void
  agentView?: { tabId: string; leafId: string | null }
  shortcutLabel: string | null
}): React.JSX.Element | null {
  if (!onSwitchToTerminal) {
    return null
  }
  if (agentView) {
    return (
      <AgentViewSubmenu
        tabId={agentView.tabId}
        leafId={agentView.leafId}
        canChat
        isChat
        onToggleChat={onSwitchToTerminal}
      />
    )
  }
  return (
    <DropdownMenuItem onSelect={onSwitchToTerminal}>
      <SquareTerminal />
      {translate(
        'components.tab.bar.SortableTabContextMenu.switchToTerminalView',
        'Continue with Terminal Agent'
      )}
      {shortcutLabel ? <DropdownMenuShortcut>{shortcutLabel}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  )
}
