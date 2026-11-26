import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import {
  isShellExitCommand,
  noteShellEditorTypedInput,
  onShellEditorTypedInput,
  takeShellEditorExit
} from './shell-editor-typed-input'

describe('isShellExitCommand', () => {
  it.each(['exit', '  exit  ', 'exit 0', 'exit 3', 'logout', '\u0004'])(
    'treats %j as leaving',
    (text) => {
      expect(isShellExitCommand(text)).toBe(true)
    }
  )

  it.each(['', 'exit; ls', 'exit && ls', 'echo exit', 'exiting', 'git exit'])(
    'treats %j as staying',
    (text) => {
      expect(isShellExitCommand(text)).toBe(false)
    }
  )
})

describe('shell editor typed input', () => {
  it('counts as typing and remembers an exit until the shell ends', () => {
    const terminal = {} as Terminal
    const typed = vi.fn()
    onShellEditorTypedInput(terminal, typed)

    noteShellEditorTypedInput(terminal, 'exit')
    expect(typed).toHaveBeenCalledOnce()
    expect(takeShellEditorExit(terminal)).toBe(true)
    expect(takeShellEditorExit(terminal)).toBe(false)
  })

  it('forgets an exit that did not end the shell once something else is sent', () => {
    const terminal = {} as Terminal
    noteShellEditorTypedInput(terminal, 'exit')
    noteShellEditorTypedInput(terminal, 'ls')
    expect(takeShellEditorExit(terminal)).toBe(false)
  })
})
