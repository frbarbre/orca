import { resolveDirectionalGroupFocus } from '../../../../shared/keybindings/directional-group-focus'
import type { KeybindingInput, KeybindingOverrides } from '../../../../shared/keybindings/types'
import { focusTabGroupInDirection } from './focus-tab-group-in-direction'

export type DirectionalGroupFocusChordResult =
  | 'handled'
  | 'worktree.history.back'
  | 'worktree.history.forward'
  | null

/** Moves focus to the tab group in the chord's direction; with a single group, names the history action the chord falls back to. */
export function handleDirectionalGroupFocusChord(
  input: KeybindingInput & { preventDefault: () => void },
  platform: NodeJS.Platform,
  keybindings: KeybindingOverrides | undefined
): DirectionalGroupFocusChordResult {
  const direction = resolveDirectionalGroupFocus(input, platform, keybindings)
  if (!direction) {
    return null
  }
  if (focusTabGroupInDirection(direction) !== 'single-group') {
    input.preventDefault()
    return 'handled'
  }
  // Why: with a single group the chord keeps worktree history's meaning, which main left to us.
  return direction === 'left'
    ? 'worktree.history.back'
    : direction === 'right'
      ? 'worktree.history.forward'
      : null
}
