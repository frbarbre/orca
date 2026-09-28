import { keybindingMatchesAction } from './matching'
import type { KeybindingActionId, KeybindingInput, KeybindingOverrides } from './types'

export type PaneFocusDirection = 'left' | 'right' | 'up' | 'down'

const DIRECTIONAL_PANE_FOCUS_ACTIONS: readonly [KeybindingActionId, PaneFocusDirection][] = [
  ['terminal.focusPaneLeft', 'left'],
  ['terminal.focusPaneRight', 'right'],
  ['terminal.focusPaneUp', 'up'],
  ['terminal.focusPaneDown', 'down']
]

export function resolveDirectionalPaneFocus(
  input: KeybindingInput,
  platform: NodeJS.Platform,
  keybindings: KeybindingOverrides | undefined
): PaneFocusDirection | null {
  for (const [actionId, direction] of DIRECTIONAL_PANE_FOCUS_ACTIONS) {
    if (keybindingMatchesAction(actionId, input, platform, keybindings)) {
      return direction
    }
  }
  return null
}
