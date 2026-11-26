import type { IDisposable, Terminal } from '@xterm/xterm'
import { parseShellEditorPromptInfo } from './shell-editor-model'
import { createShellEditorSession, type ShellEditorSession } from './shell-editor-session'
import { createShellBlockTracker, type ShellBlockTracker } from './shell-blocks-model'
import { createShellBlocksStore } from './shell-blocks-store'
import { blockCommandText, relocateShellBlocks } from './shell-blocks-view'

// Why per pane: a parked tab rebuilds its terminal, and the shell's state must survive that.
const sessionsByPaneKey = new Map<string, ShellEditorSession>()
const paneKeysByTerminal = new WeakMap<Terminal, string>()
// Why per terminal: block rows are xterm markers, which die with the terminal they were made in.
const blockTrackersByTerminal = new WeakMap<Terminal, ShellBlockTracker>()
/** How long a partly found restore waits for more rows before re-anchoring what it found. */
export const SHELL_BLOCKS_RESTORE_SETTLE_MS = 500

function rendererStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// Why kept on every change: parking can rebuild a pane's terminal without disposing the old one
// first, and a relaunch restores the pane with none of this module's memory.
const savedBlocks = createShellBlocksStore(rendererStorage())

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

/**
 * Carries a pane's blocks into its rebuilt terminal: they are re-anchored as soon as the restored
 * rows hold any of them, which may already be true or only after a later write or paint.
 */
function carryBlocksIntoTerminal(
  terminal: Terminal,
  blocks: ShellBlockTracker,
  paneKey: string
): IDisposable {
  let awaiting = savedBlocks.load(paneKey)
  let settle: ReturnType<typeof setTimeout> | undefined
  const subscriptions: IDisposable[] = []
  const restoreFound = (): boolean => {
    const found = awaiting ? relocateShellBlocks(terminal.buffer.active, awaiting) : []
    if (found.length === 0) {
      return false
    }
    awaiting = null
    clearTimeout(settle)
    blocks.restore(found, (line) => markerAt(terminal, line))
    return true
  }
  // Why wait for all of them: the restored rows can arrive over several writes.
  const tryRestore = (): void => {
    if (!awaiting) {
      return
    }
    const found = relocateShellBlocks(terminal.buffer.active, awaiting)
    if (found.length === awaiting.length) {
      restoreFound()
    } else if (found.length > 0) {
      clearTimeout(settle)
      settle = setTimeout(restoreFound, SHELL_BLOCKS_RESTORE_SETTLE_MS)
    }
  }
  // Why: the terminal can drop its markers while the rows stay, so find those blocks again by content.
  const recoverLost = (): void => {
    const lost = new Set(blocks.lostBlockIds())
    if (awaiting || lost.size === 0) {
      return
    }
    const saved = (savedBlocks.load(paneKey) ?? []).filter((block) => lost.has(block.id))
    const found = saved.length > 0 ? relocateShellBlocks(terminal.buffer.active, saved) : []
    if (found.length > 0) {
      blocks.restore(found, (line) => markerAt(terminal, line))
    } else {
      blocks.forgetLost()
    }
  }
  const onTerminalUpdate = (): void => {
    tryRestore()
    recoverLost()
  }
  const unsubscribe = blocks.subscribe(() => {
    // Why not while blocks are lost: saving now would forget the copies recoverLost reads.
    if (!awaiting && blocks.lostBlockIds().length === 0) {
      savedBlocks.save(paneKey, blocks.getBlocks())
    }
  })
  tryRestore()
  subscriptions.push(terminal.onWriteParsed(onTerminalUpdate), terminal.onRender(onTerminalUpdate))
  return {
    dispose() {
      unsubscribe()
      clearTimeout(settle)
      for (const subscription of subscriptions) {
        subscription.dispose()
      }
    }
  }
}

export function attachShellEditorSession(terminal: Terminal, paneKey: string): IDisposable {
  const session = getShellEditorSession(paneKey)
  paneKeysByTerminal.set(terminal, paneKey)
  const blocks = createShellBlockTracker()
  blockTrackersByTerminal.set(terminal, blocks)
  const carrying = carryBlocksIntoTerminal(terminal, blocks, paneKey)
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
      carrying.dispose()
      paneKeysByTerminal.delete(terminal)
      blockTrackersByTerminal.delete(terminal)
    }
  }
}

/** Called for a fresh shell spawned with the editor requested. */
export function requestShellEditor(paneKey: string, options: { keepBlocks?: boolean } = {}): void {
  // Why keep them on a cold restore: its fresh shell comes with the old scrollback they sit in.
  if (!options.keepBlocks) {
    savedBlocks.forget(paneKey)
  }
  getShellEditorSession(paneKey).markRequested()
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
