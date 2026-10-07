// Why a short window: Mod+Enter arms it while the note is saved; a save that comes much later
// (a failed write retried by hand) must not suddenly pull focus to a send button.
const ARMED_FOR_MS = 5_000

let armedUntil = 0
const pendingCommentIds = new Set<string>()

/** Mod+Enter finished a note: its send button should take focus once the card appears. */
export function armNoteSendFocus(now: number = Date.now()): void {
  armedUntil = now + ARMED_FOR_MS
}

/** Called as a note is created, before its card can render. */
export function noteCreatedForSendFocus(commentId: string, now: number = Date.now()): void {
  if (now <= armedUntil) {
    armedUntil = 0
    pendingCommentIds.add(commentId)
  }
}

/** True once for a note whose send button should take focus. */
export function takeNoteSendFocus(commentId: string): boolean {
  return pendingCommentIds.delete(commentId)
}
