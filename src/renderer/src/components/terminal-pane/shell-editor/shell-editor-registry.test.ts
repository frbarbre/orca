import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import {
  attachShellEditorSession,
  cancelShellEditorRequest,
  getShellBlockTracker,
  getShellEditorSession,
  observeShellEditorOsc133,
  requestShellEditor,
  SHELL_BLOCKS_RESTORE_SETTLE_MS
} from './shell-editor-registry'

function fakeTerminal(rows: string[] = []) {
  const handlers = new Map<number, (data: string) => boolean>()
  const writeListeners = new Set<() => void>()
  let cursorLine = 0
  const terminal = {
    parser: {
      registerOscHandler: (id: number, handler: (data: string) => boolean) => {
        handlers.set(id, handler)
        return { dispose: () => handlers.delete(id) }
      }
    },
    registerMarker: (offset = 0) => ({ line: cursorLine + offset, isDisposed: false }),
    onWriteParsed: (listener: () => void) => {
      writeListeners.add(listener)
      return { dispose: () => writeListeners.delete(listener) }
    },
    onRender: () => ({ dispose: () => {} }),
    buffer: {
      active: {
        get length() {
          return rows.length
        },
        baseY: 0,
        get cursorY() {
          return cursorLine
        },
        getLine: (index: number) =>
          index < rows.length
            ? { isWrapped: false, translateToString: () => rows[index] }
            : undefined
      }
    }
  } as unknown as Terminal
  return {
    terminal,
    osc: (id: number, data: string) => handlers.get(id)?.(data) ?? false,
    setCursor: (line: number) => {
      cursorLine = line
    },
    wrote: () => {
      for (const listener of writeListeners) {
        listener()
      }
    }
  }
}

describe('shell editor registry', () => {
  it('follows the prompt report and command markers of its terminal', () => {
    const { terminal, osc } = fakeTerminal()
    attachShellEditorSession(terminal, 'tab:leaf-a')

    expect(osc(777, 'orca-shell-editor;main;/h/.zsh_history;/repo')).toBe(true)
    expect(getShellEditorSession('tab:leaf-a').getSnapshot()).toMatchObject({
      phase: 'prompt',
      cwd: '/repo'
    })

    observeShellEditorOsc133(terminal, 'C')
    expect(getShellEditorSession('tab:leaf-a').getSnapshot().phase).toBe('running')
  })

  it('leaves other OSC 777 messages to other handlers', () => {
    const { terminal, osc } = fakeTerminal()
    attachShellEditorSession(terminal, 'tab:leaf-b')
    expect(osc(777, 'notify;title;body')).toBe(false)
  })

  it('marks a pane as starting whether the spawn request comes before or after the pane', () => {
    requestShellEditor('tab:leaf-c')
    attachShellEditorSession(fakeTerminal().terminal, 'tab:leaf-c')
    expect(getShellEditorSession('tab:leaf-c').getSnapshot().phase).toBe('starting')

    attachShellEditorSession(fakeTerminal().terminal, 'tab:leaf-d')
    requestShellEditor('tab:leaf-d')
    expect(getShellEditorSession('tab:leaf-d').getSnapshot().phase).toBe('starting')
    cancelShellEditorRequest('tab:leaf-d')
    expect(getShellEditorSession('tab:leaf-d').getSnapshot().phase).toBe('off')
  })

  it('hands the box the same session whether it renders before or after the pane attaches', () => {
    const { terminal, osc } = fakeTerminal()
    const seenByBox = getShellEditorSession('tab:leaf-f')
    attachShellEditorSession(terminal, 'tab:leaf-f')
    osc(777, 'orca-shell-editor;main;;/repo')
    expect(seenByBox.getSnapshot().phase).toBe('prompt')
  })

  it('records a block per command from the prompt, report, start and finish markers', () => {
    const { terminal, osc, setCursor } = fakeTerminal()
    requestShellEditor('tab:leaf-h')
    attachShellEditorSession(terminal, 'tab:leaf-h')
    setCursor(4)
    observeShellEditorOsc133(terminal, 'A')
    osc(777, 'orca-shell-editor2;main;;v24.14.0;/repo')
    setCursor(6)
    observeShellEditorOsc133(terminal, 'C')
    setCursor(9)
    observeShellEditorOsc133(terminal, 'D;2')

    expect(getShellBlockTracker(terminal)?.getBlocks()).toEqual([
      expect.objectContaining({
        headerLine: 4,
        outputLine: 6,
        endLine: 9,
        exitCode: 2,
        cwd: '/repo',
        branch: 'main',
        node: 'v24.14.0'
      })
    ])
  })

  it('records no blocks for a terminal without the editor', () => {
    const { terminal, setCursor } = fakeTerminal()
    attachShellEditorSession(terminal, 'tab:leaf-i')
    setCursor(1)
    observeShellEditorOsc133(terminal, 'A')
    observeShellEditorOsc133(terminal, 'C')
    expect(getShellBlockTracker(terminal)?.getBlocks()).toEqual([])
  })

  it('finds the blocks again once a rebuilt terminal has written its restored rows', () => {
    const first = fakeTerminal(['', '', 'false', '', '', '', ''])
    requestShellEditor('tab:leaf-j')
    const attached = attachShellEditorSession(first.terminal, 'tab:leaf-j')
    first.setCursor(0)
    observeShellEditorOsc133(first.terminal, 'A')
    first.osc(777, 'orca-shell-editor2;main;;;/repo')
    first.setCursor(3)
    observeShellEditorOsc133(first.terminal, 'C')
    first.setCursor(4)
    observeShellEditorOsc133(first.terminal, 'D;1')
    expect(getShellBlockTracker(first.terminal)?.getBlocks()[0].command).toBe('false')
    void attached

    const rebuiltRows: string[] = []
    const rebuilt = fakeTerminal(rebuiltRows)
    attachShellEditorSession(rebuilt.terminal, 'tab:leaf-j')
    expect(getShellBlockTracker(rebuilt.terminal)?.getBlocks()).toEqual([])
    rebuiltRows.push('older', '', '', 'false', '', '', '')
    rebuilt.setCursor(6)
    rebuilt.wrote()

    expect(getShellBlockTracker(rebuilt.terminal)?.getBlocks()).toEqual([
      expect.objectContaining({ command: 'false', headerLine: 1, exitCode: 1, cwd: '/repo' })
    ])
  })

  it('waits for the rest of a restore that arrives in pieces before re-anchoring', () => {
    vi.useFakeTimers()
    try {
      const first = fakeTerminal(['', '', 'ls', '', 'a', '', '', 'pwd', '', '/r', ''])
      requestShellEditor('tab:leaf-l')
      attachShellEditorSession(first.terminal, 'tab:leaf-l')
      for (const [prompt, start, end] of [
        [0, 3, 5],
        [5, 8, 10]
      ]) {
        first.setCursor(prompt)
        observeShellEditorOsc133(first.terminal, 'A')
        first.osc(777, 'orca-shell-editor2;main;;;/repo')
        first.setCursor(start)
        observeShellEditorOsc133(first.terminal, 'C')
        first.setCursor(end)
        observeShellEditorOsc133(first.terminal, 'D;0')
      }

      const rows: string[] = ['', '', 'ls', '', 'a']
      const rebuilt = fakeTerminal(rows)
      rebuilt.setCursor(4)
      attachShellEditorSession(rebuilt.terminal, 'tab:leaf-l')
      rebuilt.wrote()
      rows.push('', '', 'pwd', '', '/r', '')
      rebuilt.setCursor(10)
      rebuilt.wrote()
      expect(getShellBlockTracker(rebuilt.terminal)?.getBlocks().map((b) => b.command)).toEqual([
        'ls',
        'pwd'
      ])

      const partialRows: string[] = ['', '', 'pwd', '', '/r', '']
      const partial = fakeTerminal(partialRows)
      partial.setCursor(5)
      attachShellEditorSession(partial.terminal, 'tab:leaf-l')
      partial.wrote()
      expect(getShellBlockTracker(partial.terminal)?.getBlocks()).toEqual([])
      vi.advanceTimersByTime(SHELL_BLOCKS_RESTORE_SETTLE_MS)
      expect(getShellBlockTracker(partial.terminal)?.getBlocks().map((b) => b.command)).toEqual([
        'pwd'
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('finds the blocks at once when the rebuilt terminal already holds the restored rows', () => {
    const first = fakeTerminal(['', '', 'ls', '', 'a', ''])
    requestShellEditor('tab:leaf-k')
    attachShellEditorSession(first.terminal, 'tab:leaf-k')
    observeShellEditorOsc133(first.terminal, 'A')
    first.osc(777, 'orca-shell-editor2;main;;;/repo')
    first.setCursor(3)
    observeShellEditorOsc133(first.terminal, 'C')
    first.setCursor(5)
    observeShellEditorOsc133(first.terminal, 'D;0')

    const rebuilt = fakeTerminal(['', '', 'ls', '', 'a', ''])
    rebuilt.setCursor(5)
    attachShellEditorSession(rebuilt.terminal, 'tab:leaf-k')
    expect(getShellBlockTracker(rebuilt.terminal)?.getBlocks()).toEqual([
      expect.objectContaining({ command: 'ls', headerLine: 0 })
    ])
  })

  it('keeps the pane’s state when its terminal is rebuilt after parking', () => {
    const first = fakeTerminal()
    const attached = attachShellEditorSession(first.terminal, 'tab:leaf-g')
    first.osc(777, 'orca-shell-editor;main;;/repo')
    attached.dispose()
    expect(first.osc(777, 'orca-shell-editor;main;;/elsewhere')).toBe(false)

    const second = fakeTerminal()
    attachShellEditorSession(second.terminal, 'tab:leaf-g')
    expect(getShellEditorSession('tab:leaf-g').getSnapshot()).toMatchObject({
      phase: 'prompt',
      cwd: '/repo'
    })
    observeShellEditorOsc133(second.terminal, 'C')
    expect(getShellEditorSession('tab:leaf-g').getSnapshot().phase).toBe('running')
  })
})
