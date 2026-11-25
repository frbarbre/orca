import { describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import {
  attachShellEditorSession,
  cancelShellEditorRequest,
  getShellEditorSession,
  observeShellEditorOsc133,
  requestShellEditor
} from './shell-editor-registry'

function fakeTerminal() {
  const handlers = new Map<number, (data: string) => boolean>()
  const terminal = {
    parser: {
      registerOscHandler: (id: number, handler: (data: string) => boolean) => {
        handlers.set(id, handler)
        return { dispose: () => handlers.delete(id) }
      }
    }
  } as unknown as Terminal
  return { terminal, osc: (id: number, data: string) => handlers.get(id)?.(data) ?? false }
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
