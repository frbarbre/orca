import type { IDisposable, Terminal } from '@xterm/xterm'
import { parseShellEditorPromptInfo } from './shell-editor-model'
import { createShellEditorSession, type ShellEditorSession } from './shell-editor-session'
import { createShellBlockTracker, type ShellBlockTracker } from './shell-blocks-model'

// Why per pane: a parked tab rebuilds its terminal, and the shell's state must survive that.
const sessionsByPaneKey = new Map<string, ShellEditorSession>()
const paneKeysByTerminal = new WeakMap<Terminal, string>()
// Why per terminal: block rows are xterm markers, which die with the terminal they were made in.
const blockTrackersByTerminal = new WeakMap<Terminal, ShellBlockTracker>()

export function getShellBlockTracker(terminal: Terminal): ShellBlockTracker | undefined {
  return blockTrackersByTerminal.get(terminal)
}

export function getShellEditorSession(paneKey: string): ShellEditorSession {
  let session = sessionsByPaneKey.get(paneKey)
  if (!session) {
    session = createShellEditorSession()
    sessionsByPaneKey.set(paneKey, session)
  }
  return session
}

export function attachShellEditorSession(terminal: Terminal, paneKey: string): IDisposable {
  const session = getShellEditorSession(paneKey)
  paneKeysByTerminal.set(terminal, paneKey)
  const blocks = createShellBlockTracker()
  blockTrackersByTerminal.set(terminal, blocks)
  const osc777 = terminal.parser.registerOscHandler(777, (data) => {
    const info = parseShellEditorPromptInfo(data)
    if (!info) {
      return false
    }
    session.promptInfo(info)
    blocks.promptInfo(info)
    return true
  })
  return {
    dispose() {
      osc777.dispose()
      paneKeysByTerminal.delete(terminal)
      blockTrackersByTerminal.delete(terminal)
    }
  }
}

/** Called for a fresh shell spawned with the editor requested. */
export function requestShellEditor(paneKey: string): void {
  getShellEditorSession(paneKey).markRequested()
}

export function cancelShellEditorRequest(paneKey: string): void {
  sessionsByPaneKey.get(paneKey)?.cancelRequest()
}

export function observeShellEditorOsc133(terminal: Terminal, data: string): void {
  const paneKey = paneKeysByTerminal.get(terminal)
  const session = paneKey ? sessionsByPaneKey.get(paneKey) : undefined
  const [kind, exitCode] = data.split(';')
  const tracking = session !== undefined && session.getSnapshot().phase !== 'off'
  const blocks = tracking ? blockTrackersByTerminal.get(terminal) : undefined
  // Why the cursor row: each marker is written where zsh is about to print the next thing.
  const marker = blocks ? terminal.registerMarker(0) : undefined
  if (kind === 'A') {
    session?.promptStart()
    if (marker) {
      blocks?.promptStart(marker)
    }
  } else if (kind === 'C') {
    session?.commandStart()
    if (marker) {
      blocks?.commandStart(marker, Date.now())
    }
  } else if (kind === 'D' && marker) {
    const code = Number.parseInt(exitCode ?? '', 10)
    blocks?.commandFinished(marker, Number.isNaN(code) ? null : code, Date.now())
  }
}
