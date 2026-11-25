import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Terminal } from '@xterm/xterm'
import { Folder, GitBranch, Hourglass } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { PtyTransport } from '../pty-transport-types'
import {
  createShellEditorHistory,
  encodeShellEditorCommand,
  encodeShellEditorHandoff,
  resolveShellEditorKey,
  resolveShellEditorResync,
  SHELL_EDITOR_NUDGE,
  type ShellEditorHistory
} from './shell-editor-model'
import type { ShellEditorSession } from './shell-editor-session'
import { useAppStore } from '@/store'
import {
  displayShellEditorCwd,
  readShellEditorCaret,
  replaceShellEditorText,
  SHELL_EDITOR_ROOT_ATTRIBUTE
} from './shell-editor-dom'

const MAX_ROWS = 8
const HISTORY_RELOAD_MS = 5000

type ShellEditorBoxProps = {
  session: ShellEditorSession
  terminal: Terminal
  paneContainer: HTMLElement
  transport: Pick<PtyTransport, 'sendInput' | 'getPtyId'> | undefined
  isShown: boolean
  isFocusTarget: boolean
}

/** The text field has the caret, so the terminal's own cursor is hidden while the box is up. */
function useHiddenTerminalCursor(terminal: Terminal, boxShown: boolean): void {
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
function useResyncWhenShown(
  session: ShellEditorSession,
  transport: ShellEditorBoxProps['transport'],
  isShown: boolean,
  // Why not the phase: re-checking on every phase change races a quick command's own prompt report.
  gaveUp: boolean
): void {
  const enabled = useAppStore((state) => state.settings?.terminalShellEditor ?? false)
  useEffect(() => {
    const ptyId = transport?.getPtyId()
    if (!isShown || !enabled || !ptyId) {
      return
    }
    let cancelled = false
    void window.api.pty.getForegroundProcess(ptyId).then((foregroundProcess) => {
      if (cancelled) {
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
    return () => {
      cancelled = true
    }
  }, [session, transport, isShown, enabled, gaveUp])
}

/** Reserves the editor's height at the bottom of its pane so the terminal refits above it. */
function useReservePaneBottomSpace(
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

function useShellHistory(histfile: string | null): {
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

export function ShellEditorBox({
  session,
  terminal,
  paneContainer,
  transport,
  isShown,
  isFocusTarget
}: ShellEditorBoxProps): React.JSX.Element | null {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  useResyncWhenShown(session, transport, isShown, snapshot.phase === 'off')
  useHiddenTerminalCursor(terminal, snapshot.phase === 'starting' || snapshot.phase === 'prompt')
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const { history, reload: reloadHistory } = useShellHistory(snapshot.histfile)
  const visible = snapshot.phase === 'starting' || snapshot.phase === 'prompt'
  useReservePaneBottomSpace(rootRef, paneContainer, visible)

  const send = (data: string): boolean => transport?.sendInput(data, 'driving') ?? false

  useEffect(() => {
    const queued = session.takeQueued()
    if (queued !== null) {
      send(encodeShellEditorCommand(queued))
    }
  })

  // Why: zsh is ready again; hand focus back to the line the user types into.
  useEffect(() => {
    if (!visible || !isFocusTarget) {
      return
    }
    const active = document.activeElement
    if (active === document.body || (active && paneContainer.contains(active))) {
      fieldRef.current?.focus()
    }
  }, [visible, isFocusTarget, snapshot.phase, paneContainer])

  // Why: a click into the output focuses the terminal; typing there should still land in the editor.
  useEffect(() => {
    if (!visible) {
      return
    }
    const redirect = (event: KeyboardEvent): void => {
      const field = fieldRef.current
      const target = event.target
      if (
        !field ||
        !(target instanceof HTMLElement) ||
        !target.classList.contains('xterm-helper-textarea') ||
        event.key.length !== 1 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      ) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      field.focus()
      document.execCommand('insertText', false, event.key)
    }
    paneContainer.addEventListener('keydown', redirect, true)
    return () => paneContainer.removeEventListener('keydown', redirect, true)
  }, [visible, paneContainer])

  useLayoutEffect(() => {
    const field = fieldRef.current
    if (field) {
      field.rows = Math.min(MAX_ROWS, text.split('\n').length)
    }
  }, [text])

  if (!visible) {
    return null
  }

  const replaceText = (next: string): void => {
    if (fieldRef.current) {
      replaceShellEditorText(fieldRef.current, next)
    }
  }

  const handOff = (key: string): void => {
    if (send(encodeShellEditorHandoff(text, key))) {
      session.handOff()
      setText('')
      terminal.focus()
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.nativeEvent.isComposing) {
      return
    }
    const field = event.currentTarget
    const action = resolveShellEditorKey({
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      empty: text.length === 0,
      ...readShellEditorCaret(field)
    })
    if (!action) {
      return
    }
    event.preventDefault()
    switch (action) {
      case 'submit':
        if (snapshot.phase === 'starting') {
          if (text.trim()) {
            session.queue(text)
            setText('')
          }
          return
        }
        if (send(encodeShellEditorCommand(text))) {
          if (text.trim()) {
            history.record(text)
          }
          setText('')
        }
        return
      case 'historyPrevious': {
        const entry = history.previous(text)
        if (entry !== null) {
          replaceText(entry)
        }
        return
      }
      case 'historyNext': {
        const entry = history.next()
        if (entry !== null) {
          replaceText(entry)
        }
        return
      }
      case 'clear':
        replaceText('')
        return
      case 'eof':
        send('\u0004')
        return
      case 'clearScreen':
        send('\u000c')
        return
      case 'handoffSearch':
        handOff('\u0012')
        return
      case 'handoffComplete':
        handOff('\t')
    }
  }

  const theme = terminal.options.theme ?? {}
  const foreground = theme.foreground ?? 'currentColor'
  const muted = `color-mix(in srgb, ${foreground} 65%, transparent)`
  const outline = `color-mix(in srgb, ${foreground} 18%, transparent)`

  return (
    <div
      ref={rootRef}
      {...{ [SHELL_EDITOR_ROOT_ATTRIBUTE]: '' }}
      data-pane-prevent-terminal-focus=""
      className="shell-editor"
      style={{
        background: theme.background,
        color: foreground,
        borderTop: `1px solid ${outline}`,
        fontFamily: terminal.options.fontFamily,
        fontSize: terminal.options.fontSize
      }}
      onMouseDown={(event) => {
        if (event.target !== fieldRef.current) {
          event.preventDefault()
          fieldRef.current?.focus()
        }
      }}
    >
      <div className="shell-editor-chips">
        {snapshot.cwd ? (
          <span className="shell-editor-chip" style={{ borderColor: outline, color: muted }}>
            <Folder aria-hidden="true" />
            {displayShellEditorCwd(snapshot.cwd)}
          </span>
        ) : null}
        {snapshot.branch ? (
          <span className="shell-editor-chip" style={{ borderColor: outline, color: muted }}>
            <GitBranch aria-hidden="true" />
            {snapshot.branch}
          </span>
        ) : null}
        {snapshot.phase === 'starting' ? (
          <span className="shell-editor-chip" style={{ borderColor: outline, color: muted }}>
            <Hourglass aria-hidden="true" />
            {snapshot.queued
              ? translate('terminal.shellEditor.queued', 'Runs when zsh is ready')
              : translate('terminal.shellEditor.starting', 'Starting zsh')}
          </span>
        ) : null}
      </div>
      <textarea
        ref={fieldRef}
        className="shell-editor-field"
        value={text}
        rows={1}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label={translate('terminal.shellEditor.label', 'Command')}
        placeholder={snapshot.queued ?? ''}
        style={{ caretColor: theme.cursor ?? foreground }}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={reloadHistory}
      />
    </div>
  )
}
