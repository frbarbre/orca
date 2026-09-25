import type { ChangedFileStepDirection } from '@/store/slices/editor/actions/changed-file-order'

/** How often a held shortcut steps to the next file. OS key repeat fires faster than this. */
export const CHANGED_FILE_HOLD_STEP_INTERVAL_MS = 50

type HoldStep = (direction: ChangedFileStepDirection) => void

type HoldSession = {
  code: string
  direction: ChangedFileStepDirection
  matches: (event: KeyboardEvent) => boolean
  step: HoldStep
  lastStepAt: number
  dispose: () => void
}

let session: HoldSession | null = null

function endHold(): void {
  session?.dispose()
  session = null
}

/**
 * Keeps a held file-navigation shortcut stepping after the diff it started in is gone.
 *
 * Why window-level: every step opens a different file, which remounts the diff editor, so a
 * listener on the editor's container is torn down after the first step. Focus also drops to the
 * body until the next diff mounts (and never comes back for a file with no diff surface), so the
 * OS key repeats would otherwise land nowhere. The session ends on keyup, blur, a fresh press, or
 * a repeat that no longer matches the chord, e.g. a released modifier.
 */
export function beginChangedFileHold(
  event: KeyboardEvent,
  direction: ChangedFileStepDirection,
  matches: (event: KeyboardEvent) => boolean,
  step: HoldStep
): void {
  endHold()

  const handleKeyDown = (repeat: KeyboardEvent): void => {
    const active = session
    if (!active) {
      return
    }
    if (!repeat.repeat || repeat.code !== active.code || !active.matches(repeat)) {
      endHold()
      return
    }
    repeat.preventDefault()
    repeat.stopPropagation()
    // Why wall-clock rather than event.timeStamp: repeats that queued while a heavy diff was
    // mounting arrive back to back, and must be dropped rather than replayed as a burst that
    // overshoots the file the reviewer let go on.
    const now = performance.now()
    if (now - active.lastStepAt < CHANGED_FILE_HOLD_STEP_INTERVAL_MS) {
      return
    }
    active.lastStepAt = now
    active.step(active.direction)
  }
  const handleKeyUp = (release: KeyboardEvent): void => {
    if (release.code === session?.code) {
      endHold()
    }
  }

  window.addEventListener('keydown', handleKeyDown, true)
  window.addEventListener('keyup', handleKeyUp, true)
  window.addEventListener('blur', endHold)
  session = {
    code: event.code,
    direction,
    matches,
    step,
    lastStepAt: performance.now(),
    dispose: () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', endHold)
    }
  }
}

export function endChangedFileHold(): void {
  endHold()
}
