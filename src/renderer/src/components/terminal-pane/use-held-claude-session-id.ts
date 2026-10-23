import { useState } from 'react'

/**
 * Fork: the Claude session the web view shows for `leafId`, held through a moment its status row
 * reads empty. Unmounting the cover for one render flashes the terminal and reloads the page;
 * the view leaves only on proof (the portal hides it once Claude exits or its pane closes).
 */
export function useHeldClaudeSessionId(
  leafId: string | null,
  sessionId: string | null
): string | null {
  const [held, setHeld] = useState<{ leafId: string; sessionId: string } | null>(null)
  if (leafId && sessionId && (held?.leafId !== leafId || held.sessionId !== sessionId)) {
    setHeld({ leafId, sessionId })
  }
  if (!leafId) {
    return null
  }
  return sessionId ?? (held?.leafId === leafId ? held.sessionId : null)
}
