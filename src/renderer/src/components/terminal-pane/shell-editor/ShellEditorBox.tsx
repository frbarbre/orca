import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Terminal } from '@xterm/xterm'
import { FileDiff, Folder, GitBranch, Hexagon, Hourglass } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  encodeShellEditorCommand,
  encodeShellEditorHandoff,
  resolveShellEditorKey
} from './shell-editor-model'
import type { ShellEditorSession } from './shell-editor-session'
import {
  displayShellEditorCwd,
  readShellEditorCaret,
  replaceShellEditorText,
  SHELL_EDITOR_ROOT_ATTRIBUTE
} from './shell-editor-dom'
import {
  useDiffStatPerPrompt,
  useHiddenTerminalCursor,
  useReservePaneBottomSpace,
  useResyncWhenShown,
  useShellHistory,
  type ShellEditorTransport
} from './shell-editor-box-hooks'

const MAX_ROWS = 8
/** Focus this soon after a click in the output belongs to that click, e.g. to select text. */
const CLICK_FOCUS_WINDOW_MS = 400

type ShellEditorBoxProps = {
  session: ShellEditorSession
  terminal: Terminal
  paneContainer: HTMLElement
  transport: ShellEditorTransport
  isShown: boolean
  isFocusTarget: boolean
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
  const diffStat = useDiffStatPerPrompt(terminal, snapshot.cwd, snapshot.promptCount)
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

  // Why: tab and pane switches focus the terminal after this box took focus; hand it back.
  useEffect(() => {
    if (!visible) {
      return
    }
    let pointerAt = 0
    const onPointerDown = (): void => {
      pointerAt = performance.now()
    }
    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target
      const fromClick = performance.now() - pointerAt < CLICK_FOCUS_WINDOW_MS
      if (
        !fromClick &&
        target instanceof HTMLElement &&
        target.classList.contains('xterm-helper-textarea')
      ) {
        requestAnimationFrame(() => fieldRef.current?.focus())
      }
    }
    paneContainer.addEventListener('pointerdown', onPointerDown, true)
    paneContainer.addEventListener('focusin', onFocusIn)
    return () => {
      paneContainer.removeEventListener('pointerdown', onPointerDown, true)
      paneContainer.removeEventListener('focusin', onFocusIn)
    }
  }, [visible, paneContainer])

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
        {snapshot.node ? (
          <span className="shell-editor-chip" style={{ borderColor: outline, color: muted }}>
            <Hexagon aria-hidden="true" />
            {snapshot.node}
          </span>
        ) : null}
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
        {diffStat?.files ? (
          <span className="shell-editor-chip" style={{ borderColor: outline, color: muted }}>
            <FileDiff aria-hidden="true" />
            {diffStat.files} •<span style={{ color: theme.green }}>+{diffStat.insertions}</span>
            {diffStat.deletions ? (
              <span style={{ color: theme.red }}>-{diffStat.deletions}</span>
            ) : null}
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
