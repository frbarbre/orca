import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { PtyTransport } from '../pty-transport-types'
import { acquirePtyDeliveryInterest } from '../pty-delivery-interest'
import {
  createShellEditorHistory,
  resolveShellEditorResync,
  SHELL_EDITOR_NUDGE,
  type ShellEditorHistory
} from './shell-editor-model'
import type { ShellEditorSession } from './shell-editor-session'
import type { ShellDiffStat } from './shell-blocks-model'
import { getShellBlockTracker } from './shell-editor-registry'
import { useAppStore } from '@/store'

const HISTORY_RELOAD_MS = 5000
const RESYNC_RETRY_MS = 250
const RESYNC_MAX_TRIES = 40

export type ShellEditorTransport = Pick<PtyTransport, 'sendInput' | 'getPtyId'> | undefined

/** Changes against HEAD for the folder of each prompt; the next block's header shows them too. */
export function useDiffStatPerPrompt(
  terminal: Terminal,
  cwd: string | null,
  promptCount: number
): ShellDiffStat | null {
  const [diffStat, setDiffStat] = useState<ShellDiffStat | null>(null)
  useEffect(() => {
    if (!cwd || promptCount === 0) {
      return
    }
    let cancelled = false
    void window.api.shellEditor.gitDiffStat({ cwd }).then((stat) => {
      if (!cancelled) {
        setDiffStat(stat)
        getShellBlockTracker(terminal)?.setDiffStat(stat)
      }
    })
    return () => {
      cancelled = true
    }
  }, [terminal, cwd, promptCount])
  return diffStat
}

// Why: main drops a hidden pane's output and reveals a snapshot without the markers blocks are built from.
export function useLiveOutputWhileHidden(transport: ShellEditorTransport, on: boolean): void {
  const ptyId = on ? (transport?.getPtyId() ?? null) : null
  useEffect(() => (ptyId ? acquirePtyDeliveryInterest(ptyId) : undefined), [ptyId])
}

/** The text field has the caret, so the terminal's own cursor is hidden while the box is up. */
export function useHiddenTerminalCursor(terminal: Terminal, boxShown: boolean): void {
  useEffect(() => {
    if (!boxShown) {
      return
    }
    // Why local: it only changes what this xterm draws; zsh and a later program set their own.
    terminal.write('\u001b[?25l')
    return () => {
      try {
        terminal.write('\u001b[?25h')
      } catch {
        // The pane's terminal may already be disposed.
      }
    }
  }, [terminal, boxShown])
}

/** Re-checks the shell when the pane is shown, since markers printed while hidden never arrive. */
export function useResyncWhenShown(
  session: ShellEditorSession,
  transport: ShellEditorTransport,
  isShown: boolean,
  // Why not the phase: re-checking on every phase change races a quick command's own prompt report.
  gaveUp: boolean
): void {
  const enabled = useAppStore((state) => state.settings?.terminalShellEditor ?? false)
  useEffect(() => {
    if (!isShown || !enabled) {
      return
    }
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | undefined
    // Why retry: after a relaunch the pane shows before it reattaches, so it has no pty or process yet.
    const attempt = (tries: number): void => {
      // Why only while unknown: once zsh reported, a late check would race its next command.
      const again = (): void => {
        if (!cancelled && tries < RESYNC_MAX_TRIES && session.getSnapshot().phase === 'off') {
          retry = setTimeout(() => attempt(tries + 1), RESYNC_RETRY_MS)
        }
      }
      const ptyId = transport?.getPtyId()
      if (!ptyId) {
        again()
        return
      }
      void window.api.pty.getForegroundProcess(ptyId).then((foregroundProcess) => {
        if (cancelled) {
          return
        }
        if (!foregroundProcess) {
          again()
          return
        }
        const action = resolveShellEditorResync({
          phase: session.getSnapshot().phase,
          foregroundProcess,
          nudged: session.wasNudged()
        })
        if (action === 'running') {
          session.commandStart()
        } else if (action === 'nudge' && transport?.sendInput(SHELL_EDITOR_NUDGE, 'driving')) {
          session.markNudged()
        }
      })
    }
    attempt(0)
    return () => {
      cancelled = true
      clearTimeout(retry)
    }
  }, [session, transport, isShown, enabled, gaveUp])
}

/** Reserves the editor's height at the bottom of its pane so the terminal refits above it. */
export function useReservePaneBottomSpace(
  ref: React.RefObject<HTMLDivElement | null>,
  pane: HTMLElement,
  visible: boolean
): void {
  useLayoutEffect(() => {
    const editor = ref.current
    if (!visible || !editor) {
      return
    }
    const reserve = (): void =>
      pane.style.setProperty('--orca-pane-bottom-editor-height', `${editor.offsetHeight}px`)
    reserve()
    const observer = new ResizeObserver(reserve)
    observer.observe(editor)
    return () => {
      observer.disconnect()
      pane.style.removeProperty('--orca-pane-bottom-editor-height')
    }
  }, [ref, pane, visible])
}

export function useShellHistory(histfile: string | null): {
  history: ShellEditorHistory
  reload: () => void
} {
  const [history] = useState(() => createShellEditorHistory([]))
  const loadedAt = useRef(0)
  useEffect(() => {
    loadedAt.current = 0
  }, [histfile])
  useEffect(() => {
    if (!histfile) {
      return
    }
    let cancelled = false
    void window.api.shellEditor.readHistory({ path: histfile }).then((entries) => {
      if (!cancelled) {
        history.replace(entries)
        loadedAt.current = Date.now()
      }
    })
    return () => {
      cancelled = true
    }
  }, [histfile, history])
  // Why reload on focus: other terminals append to the same file while this one sits idle.
  const reload = (): void => {
    if (!histfile || Date.now() - loadedAt.current < HISTORY_RELOAD_MS) {
      return
    }
    loadedAt.current = Date.now()
    void window.api.shellEditor.readHistory({ path: histfile }).then((entries) => {
      history.replace(entries)
    })
  }
  return { history, reload }
}
