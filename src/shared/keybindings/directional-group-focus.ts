import { keybindingMatchesAction } from './matching'
import type { KeybindingActionId, KeybindingInput, KeybindingOverrides } from './types'

export type FocusDirection = 'left' | 'right' | 'up' | 'down'

const DIRECTIONAL_GROUP_FOCUS_ACTIONS: readonly [KeybindingActionId, FocusDirection][] = [
  ['tabGroup.focusLeft', 'left'],
  ['tabGroup.focusRight', 'right'],
  ['tabGroup.focusUp', 'up'],
  ['tabGroup.focusDown', 'down']
]

export function resolveDirectionalGroupFocus(
  input: KeybindingInput,
  platform: NodeJS.Platform,
  keybindings: KeybindingOverrides | undefined
): FocusDirection | null {
  for (const [actionId, direction] of DIRECTIONAL_GROUP_FOCUS_ACTIONS) {
    if (keybindingMatchesAction(actionId, input, platform, keybindings)) {
      return direction
    }
  }
  return null
}
