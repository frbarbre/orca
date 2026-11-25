import { describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import {
  attachShellEditorSession,
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
    expect(getShellEditorSession(terminal)?.getSnapshot()).toMatchObject({
      phase: 'prompt',
      cwd: '/repo'
    })

    observeShellEditorOsc133(terminal, 'C')
    expect(getShellEditorSession(terminal)?.getSnapshot().phase).toBe('running')
  })

  it('leaves other OSC 777 messages to other handlers', () => {
    const { terminal, osc } = fakeTerminal()
    attachShellEditorSession(terminal, 'tab:leaf-b')
    expect(osc(777, 'notify;title;body')).toBe(false)
  })

  it('marks a pane as starting whether the spawn request comes before or after the pane', () => {
    requestShellEditor('tab:leaf-c')
    const early = fakeTerminal()
    attachShellEditorSession(early.terminal, 'tab:leaf-c')
    expect(getShellEditorSession(early.terminal)?.getSnapshot().phase).toBe('starting')

    const late = fakeTerminal()
    attachShellEditorSession(late.terminal, 'tab:leaf-d')
    requestShellEditor('tab:leaf-d')
    expect(getShellEditorSession(late.terminal)?.getSnapshot().phase).toBe('starting')
  })

  it('forgets the pane when detached', () => {
    const { terminal, osc } = fakeTerminal()
    const attached = attachShellEditorSession(terminal, 'tab:leaf-e')
    attached.dispose()
    expect(getShellEditorSession(terminal)).toBeUndefined()
    expect(osc(777, 'orca-shell-editor;;;/repo')).toBe(false)
  })
})
