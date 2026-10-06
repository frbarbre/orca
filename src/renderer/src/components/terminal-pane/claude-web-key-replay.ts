import type { ClaudeWebReplayedKey } from '../../../../shared/claude-remote-session'

let installed = false

// Why replay rather than call actions: Orca's shortcuts live in window keydown listeners, so a
// replayed key reaches every one of them, with the user's rebinds, exactly as if typed in Orca.
export function replayClaudeWebKey(key: ClaudeWebReplayedKey, target: EventTarget): void {
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

/** Subscribes once per window, however many Claude web views are open. */
export function ensureClaudeWebKeyReplay(): void {
  if (installed) {
    return
  }
  installed = true
  window.api.claudeRemoteSession.onReplayKey((key) => replayClaudeWebKey(key, document.body))
}
