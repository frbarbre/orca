import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { useAppStore } from '@/store'
import { getKnownExecutionHostIdForWorktree } from '@/lib/worktree-runtime-owner'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager'
import { ClaudeWebView } from './ClaudeWebView'
import {
  claudeWebView,
  resolvePaneClaudeSessionId,
  useClaudeWebViewLeafId
} from './claude-web-view-state'
import { useCoveredTerminalFocusHandoff } from './use-covered-terminal-focus-handoff'
import { useClaudeWebAutoOpen } from './use-claude-web-auto-open'
import { useHeldClaudeSessionId } from './use-held-claude-session-id'
import { CLAUDE_WEB_COVER_ATTRIBUTE } from './claude-web-covered-pane'
import { focusClaudeWebview } from './claude-web-drag-passthrough'
import type { TerminalPaneController } from './use-terminal-pane-controller'

function ClaudeWebPaneCover({
  pane,
  tabId,
  sessionId,
  hostId,
  onSwitchToTerminal
}: {
  pane: Pick<ManagedPane, 'terminal'>
  tabId: string
  sessionId: string
  hostId: ExecutionHostId | null
  onSwitchToTerminal: () => void
}): React.JSX.Element {
  const coverRef = useRef<HTMLDivElement>(null)
  useCoveredTerminalFocusHandoff(coverRef, pane.terminal)
  return (
    <div
      ref={coverRef}
      tabIndex={-1}
      {...{ [CLAUDE_WEB_COVER_ATTRIBUTE]: '' }}
      // Why native-chat-pane-shell: it is the "terminal is covered" marker, so the hidden terminal's
      // paste/copy/focus handling stands aside and these chords reach the page. z-20 sits above chat.
      className="native-chat-pane-shell absolute inset-0 z-20 flex min-h-0 min-w-0 bg-background focus:outline-none"
      onFocus={(event) => {
        const webview = event.currentTarget.querySelector<HTMLElement>('webview')
        if (event.target === event.currentTarget && webview) {
          focusClaudeWebview(webview)
        }
      }}
    >
      <ClaudeWebView
        tabId={tabId}
        sessionId={sessionId}
        hostId={hostId}
        onSwitchToTerminal={onSwitchToTerminal}
      />
    </div>
  )
}

export function TerminalPaneClaudeWebPortal({
  controller
}: {
  controller: Pick<TerminalPaneController, 'managedPanes' | 'tabId' | 'worktreeId'>
}): React.JSX.Element | null {
  const { managedPanes, tabId, worktreeId } = controller
  const leafId = useClaudeWebViewLeafId(tabId)
  const hide = claudeWebView.hide
  const liveSessionId = useAppStore((state) =>
    leafId ? resolvePaneClaudeSessionId(state, makePaneKey(tabId, leafId)) : null
  )
  const sessionId = useHeldClaudeSessionId(leafId, liveSessionId)
  // Why: Claude Code writes the session's claude.ai link on the host it runs on, e.g. over SSH.
  const hostId = useAppStore((state) => getKnownExecutionHostIdForWorktree(state, worktreeId))
  const exitedToShell = useAppStore((state) =>
    leafId
      ? state.paneForegroundAgentByPaneKey[makePaneKey(tabId, leafId)]?.shellForeground === true
      : false
  )
  const pane = leafId ? managedPanes.find((candidate) => candidate.leafId === leafId) : undefined
  useClaudeWebAutoOpen(tabId, leafId)

  // Why only on proof: after a reload the session and panes arrive late, and a missing one then
  // must not forget the remembered view. Claude exiting, or its pane closing, is proof.
  const orphaned =
    leafId !== null && (exitedToShell || (managedPanes.length > 0 && pane === undefined))
  useEffect(() => {
    if (orphaned) {
      hide(tabId)
    }
  }, [hide, orphaned, tabId])

  if (!sessionId || !pane?.container) {
    return null
  }
  return createPortal(
    <ClaudeWebPaneCover
      pane={pane}
      tabId={tabId}
      sessionId={sessionId}
      hostId={hostId}
      onSwitchToTerminal={() => hide(tabId)}
    />,
    pane.container,
    `claude-web-${tabId}-${pane.leafId}`
  )
}
