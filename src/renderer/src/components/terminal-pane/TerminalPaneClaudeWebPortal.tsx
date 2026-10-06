import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { useAppStore } from '@/store'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { ClaudeWebView } from './ClaudeWebView'
import {
  claudeWebView,
  resolvePaneClaudeSessionId,
  useClaudeWebViewLeafId
} from './claude-web-view-state'
import { useCoveredTerminalFocusHandoff } from './use-covered-terminal-focus-handoff'
import type { TerminalPaneController } from './use-terminal-pane-controller'

function ClaudeWebPaneCover({
  pane,
  sessionId,
  onSwitchToTerminal
}: {
  pane: Pick<ManagedPane, 'terminal'>
  sessionId: string
  onSwitchToTerminal: () => void
}): React.JSX.Element {
  const coverRef = useRef<HTMLDivElement>(null)
  useCoveredTerminalFocusHandoff(coverRef, pane.terminal)
  return (
    <div
      ref={coverRef}
      tabIndex={-1}
      // Why native-chat-pane-shell: it is the "terminal is covered" marker, so the hidden terminal's
      // paste/copy/focus handling stands aside and these chords reach the page. z-20 sits above chat.
      className="native-chat-pane-shell absolute inset-0 z-20 flex min-h-0 min-w-0 bg-background focus:outline-none"
      onFocus={(event) => {
        if (event.target === event.currentTarget) {
          event.currentTarget.querySelector<HTMLElement>('webview')?.focus()
        }
      }}
    >
      <ClaudeWebView sessionId={sessionId} onSwitchToTerminal={onSwitchToTerminal} />
    </div>
  )
}

export function TerminalPaneClaudeWebPortal({
  controller
}: {
  controller: Pick<TerminalPaneController, 'managedPanes' | 'tabId'>
}): React.JSX.Element | null {
  const { managedPanes, tabId } = controller
  const leafId = useClaudeWebViewLeafId(tabId)
  const hide = claudeWebView.hide
  const sessionId = useAppStore((state) =>
    leafId ? resolvePaneClaudeSessionId(state, makePaneKey(tabId, leafId)) : null
  )
  const pane = leafId ? managedPanes.find((candidate) => candidate.leafId === leafId) : undefined

  // Why: once Claude exits or its pane closes there is no session left to show.
  const orphaned = leafId !== null && (!sessionId || !pane)
  useEffect(() => {
    if (orphaned) {
      hide(tabId)
    }
  }, [hide, orphaned, tabId])

  if (!sessionId || !pane?.container) {
    return null
  }
  return createPortal(
    <ClaudeWebPaneCover pane={pane} sessionId={sessionId} onSwitchToTerminal={() => hide(tabId)} />,
    pane.container,
    `claude-web-${tabId}-${pane.leafId}`
  )
}
