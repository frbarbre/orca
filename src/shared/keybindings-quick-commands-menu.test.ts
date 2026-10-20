import { describe, expect, it } from 'vitest'
import { keybindingMatchesAction } from './keybindings'

describe('quick commands menu shortcut', () => {
  it('opens with Option+Cmd+P on macOS, where Option+P types π', () => {
    expect(
      keybindingMatchesAction(
        'tab.openQuickCommandsMenu',
        { key: 'π', code: 'KeyP', control: false, meta: true, alt: true, shift: false },
        'darwin'
      )
    ).toBe(true)
  })
})
