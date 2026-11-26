import type { IDisposable, Terminal } from '@xterm/xterm'
import { parseShellEditorPromptInfo } from './shell-editor-model'
import { createShellEditorSession, type ShellEditorSession } from './shell-editor-session'
import {
  createShellBlockTracker,
  type ShellBlock,
  type ShellBlockTracker
} from './shell-blocks-model'
import { blockCommandText, relocateShellBlocks } from './shell-blocks-view'

// Why per pane: a parked tab rebuilds its terminal, and the shell's state must survive that.
const sessionsByPaneKey = new Map<string, ShellEditorSession>()
const paneKeysByTerminal = new WeakMap<Terminal, string>()
// Why per terminal: block rows are xterm markers, which die with the terminal they were made in.
const blockTrackersByTerminal = new WeakMap<Terminal, ShellBlockTracker>()
// A rebuilt pane's blocks, waiting for its new terminal to write the restored rows they sit on.
const blocksAwaitingRebuild = new Map<string, ShellBlock[]>()

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

function markerAt(terminal: Terminal, line: number) {
  const buffer = terminal.buffer.active
  return terminal.registerMarker(line - (buffer.baseY + buffer.cursorY))
}

/** Re-anchors saved blocks once the restored rows hold any of them; the first write may be empty. */
function restoreBlocksOnWrite(
  terminal: Terminal,
  blocks: ShellBlockTracker,
  paneKey: string
): IDisposable | null {
  const saved = blocksAwaitingRebuild.get(paneKey)
  if (!saved?.length) {
    return null
  }
  const listener = terminal.onWriteParsed(() => {
    const found = relocateShellBlocks(terminal.buffer.active, saved)
    if (found.length === 0) {
      return
    }
    blocksAwaitingRebuild.delete(paneKey)
    listener.dispose()
    blocks.restore(found, (line) => markerAt(terminal, line))
  })
  return listener
}

export function attachShellEditorSession(terminal: Terminal, paneKey: string): IDisposable {
  const session = getShellEditorSession(paneKey)
  paneKeysByTerminal.set(terminal, paneKey)
  const blocks = createShellBlockTracker()
  blockTrackersByTerminal.set(terminal, blocks)
  const restoring = restoreBlocksOnWrite(terminal, blocks, paneKey)
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
      restoring?.dispose()
      const current = blocks.getBlocks()
      if (current.length > 0) {
        blocksAwaitingRebuild.set(paneKey, current)
      }
      paneKeysByTerminal.delete(terminal)
      blockTrackersByTerminal.delete(terminal)
    }
  }
}

/** Called for a fresh shell spawned with the editor requested. */
export function requestShellEditor(paneKey: string): void {
  blocksAwaitingRebuild.delete(paneKey)
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
    const headerLine = blocks?.pendingHeaderLine() ?? null
    if (marker && headerLine !== null) {
      // Why read now: zsh has just echoed the command between the prompt and this row.
      const command = blockCommandText(terminal.buffer.active, {
        headerLine,
        outputLine: marker.line
      })
      blocks?.commandStart(marker, Date.now(), command)
    }
  } else if (kind === 'D' && marker) {
    const code = Number.parseInt(exitCode ?? '', 10)
    blocks?.commandFinished(marker, Number.isNaN(code) ? null : code, Date.now())
  }
}
