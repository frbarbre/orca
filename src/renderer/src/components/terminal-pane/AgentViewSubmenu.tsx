import { Eye, Globe, MessageSquare, SquareTerminal } from 'lucide-react'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { findClaudeWebLeafId, useClaudeWebViewLeafId } from './claude-web-view-state'

import { applyAgentViewChoice, type AgentView } from './agent-view-choice'

function isAgentView(value: string): value is AgentView {
  return value === 'terminal' || value === 'chat' || value === 'claude-web'
}

/**
 * One choice between the terminal, the native chat UI and the claude.ai web view, so picking a
 * view always shows it — the web view covers both others, so each pick has to clear it first.
 */
export function AgentViewSubmenu({
  tabId,
  leafId,
  canChat,
  isChat,
  onToggleChat
}: {
  tabId: string
  leafId?: string | null
  canChat: boolean
  isChat: boolean
  onToggleChat?: () => void
}): React.JSX.Element | null {
  const shownLeafId = useClaudeWebViewLeafId(tabId)
  const claudeLeafId = useAppStore((state) => findClaudeWebLeafId(state, tabId, leafId))
  const webShown = shownLeafId !== null && (leafId == null || shownLeafId === leafId)
  const chatAvailable = canChat && onToggleChat !== undefined
  const webAvailable = webShown || claudeLeafId !== null
  if (!chatAvailable && !webAvailable) {
    return null
  }
  const current: AgentView = webShown ? 'claude-web' : isChat ? 'chat' : 'terminal'

  const select = (next: AgentView): void =>
    applyAgentViewChoice({ next, tabId, claudeLeafId, isChat, onToggleChat })

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Eye />
        {translate('auto.components.terminal.pane.AgentViewSubmenu.view', 'View')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (isAgentView(value)) {
              select(value)
            }
          }}
        >
          <DropdownMenuRadioItem value="terminal">
            <SquareTerminal />
            {translate('auto.components.terminal.pane.AgentViewSubmenu.terminal', 'Terminal')}
          </DropdownMenuRadioItem>
          {chatAvailable ? (
            <DropdownMenuRadioItem value="chat">
              <MessageSquare />
              {translate('auto.components.terminal.pane.AgentViewSubmenu.chat', 'Chat UI')}
            </DropdownMenuRadioItem>
          ) : null}
          {webAvailable ? (
            <DropdownMenuRadioItem value="claude-web">
              <Globe />
              {translate('auto.components.terminal.pane.AgentViewSubmenu.claudeWeb', 'Claude web')}
            </DropdownMenuRadioItem>
          ) : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
