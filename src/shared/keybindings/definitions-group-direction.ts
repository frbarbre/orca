import type { KeybindingDefinition } from './types'

function focusGroupDefinition(
  id: KeybindingDefinition['id'],
  title: string,
  direction: string,
  arrow: string
): KeybindingDefinition {
  return {
    id,
    title,
    group: 'Tabs',
    scope: 'global',
    searchKeywords: ['shortcut', 'group', 'split', 'window', 'focus', 'navigate', direction],
    defaultBindings: { darwin: [`Mod+Alt+${arrow}`], linux: [], win32: [] },
    allowInTerminal: true
  }
}

export const KEYBINDING_DEFINITION_GROUP_DIRECTION: readonly KeybindingDefinition[] = [
  focusGroupDefinition('tabGroup.focusLeft', 'Focus group to the left', 'left', 'ArrowLeft'),
  focusGroupDefinition('tabGroup.focusRight', 'Focus group to the right', 'right', 'ArrowRight'),
  focusGroupDefinition('tabGroup.focusUp', 'Focus group above', 'up', 'ArrowUp'),
  focusGroupDefinition('tabGroup.focusDown', 'Focus group below', 'down', 'ArrowDown')
]
