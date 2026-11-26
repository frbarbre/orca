import type { KeybindingDefinition } from './types'

function openGroupDefinition(
  id: KeybindingDefinition['id'],
  title: string,
  direction: string
): KeybindingDefinition {
  return {
    id,
    title,
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'terminal', 'split', 'group', 'window', direction],
    defaultBindings: { darwin: [], linux: [], win32: [] }
  }
}

/** Fork: Warp-style splits that open a terminal tab in a new group instead of a pane. */
export const KEYBINDING_DEFINITION_TERMINAL_GROUP_SPLIT: readonly KeybindingDefinition[] = [
  openGroupDefinition(
    'terminal.openGroupRight',
    'Open terminal in a new group to the right',
    'right'
  ),
  openGroupDefinition('terminal.openGroupDown', 'Open terminal in a new group below', 'down')
]
