import type { ShellEditorPromptInfo } from './shell-editor-model'

/** How long a prompt may go without the editor's report before the shell is taken as not zsh. */
export const SHELL_EDITOR_NOT_ZSH_GRACE_MS = 1000
/** How long a requested editor waits for zsh's first prompt before handing typing to the terminal. */
export const SHELL_EDITOR_STARTUP_TIMEOUT_MS = 30_000

export type ShellEditorPhase = 'off' | 'starting' | 'prompt' | 'running' | 'handoff'

export type ShellEditorSnapshot = {
  phase: ShellEditorPhase
  branch: string | null
  histfile: string | null
  node: string | null
  cwd: string | null
  queued: string | null
  /** Bumped by every prompt report, so a prompt in the same folder still reads as new. */
  promptCount: number
}

export type ShellEditorSession = {
  getSnapshot: () => ShellEditorSnapshot
  subscribe: (listener: () => void) => () => void
  markRequested: () => void
  promptStart: () => void
  promptInfo: (info: ShellEditorPromptInfo) => void
  commandStart: () => void
  /** An empty line was sent so an idle zsh reports its prompt again; sent once per lost track. */
  markNudged: () => void
  wasNudged: () => boolean
  handOff: () => void
  queue: (command: string) => void
  /** The queued command once zsh is at a prompt; null before then or when nothing is queued. */
  takeQueued: () => string | null
  dispose: () => void
}

export function createShellEditorSession(): ShellEditorSession {
  let snapshot: ShellEditorSnapshot = {
    phase: 'off',
    branch: null,
    histfile: null,
    node: null,
    cwd: null,
    queued: null,
    promptCount: 0
  }
  let timer: ReturnType<typeof setTimeout> | null = null
  let nudged = false
  const listeners = new Set<() => void>()

  function update(patch: Partial<ShellEditorSnapshot>): void {
    const next = { ...snapshot, ...patch }
    const changed = (Object.keys(next) as (keyof ShellEditorSnapshot)[]).some(
      (key) => next[key] !== snapshot[key]
    )
    if (!changed) {
      return
    }
    snapshot = next
    for (const listener of listeners) {
      listener()
    }
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function giveUpAfter(ms: number): void {
    clearTimer()
    timer = setTimeout(() => {
      timer = null
      update({ phase: 'off' })
    }, ms)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    markRequested() {
      // Why: zsh can report its first prompt before the spawn call that asked for it returns.
      if (snapshot.phase === 'prompt' || snapshot.phase === 'running') {
        return
      }
      update({ phase: 'starting' })
      giveUpAfter(SHELL_EDITOR_STARTUP_TIMEOUT_MS)
    },
    promptStart() {
      // Why only while starting: the editor's report follows this marker within the same prompt.
      if (snapshot.phase === 'starting') {
        giveUpAfter(SHELL_EDITOR_NOT_ZSH_GRACE_MS)
      }
    },
    promptInfo(info) {
      clearTimer()
      nudged = false
      update({ phase: 'prompt', ...info, promptCount: snapshot.promptCount + 1 })
    },
    markNudged() {
      nudged = true
    },
    wasNudged: () => nudged,
    commandStart() {
      if (snapshot.phase !== 'off') {
        update({ phase: 'running' })
      }
    },
    handOff() {
      update({ phase: 'handoff' })
    },
    queue(command) {
      update({ queued: command })
    },
    takeQueued() {
      if (snapshot.phase !== 'prompt' || snapshot.queued === null) {
        return null
      }
      const queued = snapshot.queued
      update({ queued: null })
      return queued
    },
    dispose() {
      clearTimer()
      listeners.clear()
    }
  }
}
