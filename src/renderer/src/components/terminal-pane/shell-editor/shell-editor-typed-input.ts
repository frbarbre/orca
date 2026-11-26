import type { Terminal } from '@xterm/xterm'

const typedInputListeners = new WeakMap<Terminal, () => void>()
const exitingTerminals = new WeakSet<Terminal>()

const SHELL_EXIT = /^\s*(?:exit(?:\s+\d+)?|logout)\s*$/

export function isShellExitCommand(text: string): boolean {
  return text === '\u0004' || SHELL_EXIT.test(text)
}

export function onShellEditorTypedInput(terminal: Terminal, listener: () => void): void {
  typedInputListeners.set(terminal, listener)
}

export function noteShellEditorTypedInput(terminal: Terminal, text: string): void {
  typedInputListeners.get(terminal)?.()
  if (isShellExitCommand(text)) {
    exitingTerminals.add(terminal)
  } else {
    exitingTerminals.delete(terminal)
  }
}

export function takeShellEditorExit(terminal: Terminal): boolean {
  return exitingTerminals.delete(terminal)
}
