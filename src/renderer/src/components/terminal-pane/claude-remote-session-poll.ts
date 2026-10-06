import type { ClaudeRemoteSessionUrlResult } from '../../../../shared/claude-remote-session'

export const REMOTE_CONTROL_WAIT_MS = 30_000
const REMOTE_CONTROL_POLL_MS = 1_500

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true }
    )
  })
}

// Why: a session that just started writes its file, then connects Remote Control, a few seconds
// later; one that has run longer than the wait without it has Remote Control off.
function isStillStarting(result: ClaudeRemoteSessionUrlResult, now: number): boolean {
  return (
    result.status === 'session-not-found' ||
    (result.status === 'remote-control-off' && now - result.startedAt < REMOTE_CONTROL_WAIT_MS)
  )
}

export async function pollClaudeRemoteSessionUrl(
  resolve: () => Promise<ClaudeRemoteSessionUrlResult>,
  signal: AbortSignal,
  now: () => number = Date.now
): Promise<ClaudeRemoteSessionUrlResult> {
  const deadline = now() + REMOTE_CONTROL_WAIT_MS
  for (;;) {
    const result = await resolve()
    signal.throwIfAborted()
    if (result.status === 'ready' || !isStillStarting(result, now()) || now() >= deadline) {
      return result
    }
    await sleep(REMOTE_CONTROL_POLL_MS, signal)
  }
}
