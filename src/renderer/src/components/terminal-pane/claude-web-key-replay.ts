import type { ClaudeWebReplayedKey } from '../../../../shared/claude-remote-session'
import { requestActiveTerminalPaneSplit } from '@/components/tab-bar/request-active-terminal-pane-split'
import { observeWorkspaceIndexShortcutKey } from '../sidebar/workspace-index-shortcut-hint'
import { CLAUDE_WEB_COVER_ATTRIBUTE } from './claude-web-covered-pane'

let installed = false

// Why replay rather than call actions: Orca's shortcuts live in window keydown listeners, so a
// replayed key reaches every one of them, with the user's rebinds, exactly as if typed in Orca.
export function replayClaudeWebKey(
  key: ClaudeWebReplayedKey,
  target: EventTarget,
  focusedTabId: string | null = null
): void {
  if (key.observed) {
    observeWorkspaceIndexShortcutKey(key)
    return
  }
  if (key.split) {
    if (focusedTabId) {
      requestActiveTerminalPaneSplit({
        tabId: focusedTabId,
        direction: key.split === 'right' ? 'vertical' : 'horizontal'
      })
    }
    return
  }
  target.dispatchEvent(
    new KeyboardEvent(key.type, {
      key: key.key,
      code: key.code,
      metaKey: key.metaKey,
      ctrlKey: key.ctrlKey,
      altKey: key.altKey,
      shiftKey: key.shiftKey,
      bubbles: true,
      cancelable: true
    })
  )
}

function focusedClaudeWebTabId(): string | null {
  return (
    document.activeElement
      ?.closest(`[${CLAUDE_WEB_COVER_ATTRIBUTE}]`)
      ?.getAttribute(CLAUDE_WEB_COVER_ATTRIBUTE) || null
  )
}

/** Subscribes once per window, however many Claude web views are open. */
export function ensureClaudeWebKeyReplay(): void {
  if (installed) {
    return
  }
  installed = true
  window.api.claudeRemoteSession.onReplayKey((key) =>
    replayClaudeWebKey(key, document.body, focusedClaudeWebTabId())
  )
}
