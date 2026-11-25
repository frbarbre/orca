import type { IDisposable, Terminal } from '@xterm/xterm'
import { parseShellEditorPromptInfo } from './shell-editor-model'
import { createShellEditorSession, type ShellEditorSession } from './shell-editor-session'

const sessionsByTerminal = new WeakMap<Terminal, ShellEditorSession>()
const sessionsByPaneKey = new Map<string, ShellEditorSession>()
// Why: a spawn can be requested before its pane's terminal exists.
const pendingRequests = new Set<string>()

export function attachShellEditorSession(terminal: Terminal, paneKey: string): IDisposable {
  const session = createShellEditorSession()
  sessionsByTerminal.set(terminal, session)
  sessionsByPaneKey.set(paneKey, session)
  if (pendingRequests.delete(paneKey)) {
    session.markRequested()
  }
  const osc777 = terminal.parser.registerOscHandler(777, (data) => {
    const info = parseShellEditorPromptInfo(data)
    if (!info) {
      return false
    }
    session.promptInfo(info)
    return true
  })
  return {
    dispose() {
      osc777.dispose()
      session.dispose()
      sessionsByTerminal.delete(terminal)
      if (sessionsByPaneKey.get(paneKey) === session) {
        sessionsByPaneKey.delete(paneKey)
      }
    }
  }
}

/** Called for a fresh shell spawned with the editor requested. */
export function requestShellEditor(paneKey: string): void {
  const session = sessionsByPaneKey.get(paneKey)
  if (session) {
    session.markRequested()
  } else {
    pendingRequests.add(paneKey)
  }
}

export function cancelShellEditorRequest(paneKey: string): void {
  pendingRequests.delete(paneKey)
  sessionsByPaneKey.get(paneKey)?.cancelRequest()
}

export function observeShellEditorOsc133(terminal: Terminal, data: string): void {
  const session = sessionsByTerminal.get(terminal)
  const kind = data.split(';', 1)[0]
  if (kind === 'A') {
    session?.promptStart()
  } else if (kind === 'C') {
    session?.commandStart()
  }
}

export function getShellEditorSession(terminal: Terminal): ShellEditorSession | undefined {
  return sessionsByTerminal.get(terminal)
}
