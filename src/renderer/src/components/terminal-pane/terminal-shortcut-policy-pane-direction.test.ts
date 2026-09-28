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

describe('directional pane focus', () => {
  it('maps Cmd+Option+Arrow to a direction on macOS', () => {
    for (const [key, direction] of [
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down']
    ] as const) {
      expect(
        resolveTerminalShortcutAction(
          event({ key, code: key, metaKey: true, altKey: true }),
          true,
          'true'
        )
      ).toEqual({ type: 'focusPaneInDirection', direction })
    }
  })

  it('leaves Option+Arrow to the shell for word movement', () => {
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }),
        true,
        'true'
      )
    ).not.toMatchObject({ type: 'focusPaneInDirection' })
  })

  it('follows a remapped binding', () => {
    expect(
      resolveTerminalShortcutAction(
        event({ key: 'h', code: 'KeyH', metaKey: true, altKey: true }),
        true,
        'true',
        0,
        false,
        { 'terminal.focusPaneLeft': ['Mod+Alt+H'] }
      )
    ).toEqual({ type: 'focusPaneInDirection', direction: 'left' })
  })
})
