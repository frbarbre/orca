import type { IDisposable, Terminal } from '@xterm/xterm'
import { parseShellEditorPromptInfo } from './shell-editor-model'
import { createShellEditorSession, type ShellEditorSession } from './shell-editor-session'

// Why per pane: a parked tab rebuilds its terminal, and the shell's state must survive that.
const sessionsByPaneKey = new Map<string, ShellEditorSession>()
const paneKeysByTerminal = new WeakMap<Terminal, string>()

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
      paneKeysByTerminal.delete(terminal)
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
  const kind = data.split(';', 1)[0]
  if (kind === 'A') {
    session?.promptStart()
  } else if (kind === 'C') {
    session?.commandStart()
  }
}
