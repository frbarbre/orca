import { describe, expect, it } from 'vitest'
import {
  resolveTerminalShortcutAction,
  type TerminalShortcutEvent
} from './terminal-shortcut-policy'

function event(overrides: Partial<TerminalShortcutEvent>): TerminalShortcutEvent {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...overrides
  }
}

describe('openTerminalGroup', () => {
  it('opens a terminal in a new group beside or below only when users assign it', () => {
    const cmdD = event({ key: 'd', code: 'KeyD', metaKey: true })
    const cmdShiftD = event({ key: 'd', code: 'KeyD', metaKey: true, shiftKey: true })
    expect(resolveTerminalShortcutAction(cmdD, true)).toEqual({
      type: 'splitActivePane',
      direction: 'vertical'
    })
    const keybindings = {
      'terminal.splitRight': [],
      'terminal.splitDown': [],
      'terminal.openGroupRight': ['Mod+D'],
      'terminal.openGroupDown': ['Mod+Shift+D']
    }
    expect(resolveTerminalShortcutAction(cmdD, true, 'false', 0, false, keybindings)).toEqual({
      type: 'openTerminalGroup',
      direction: 'right'
    })
    expect(resolveTerminalShortcutAction(cmdShiftD, true, 'false', 0, false, keybindings)).toEqual({
      type: 'openTerminalGroup',
      direction: 'down'
    })
  })
})
