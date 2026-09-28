import type { KeybindingDefinition } from './types'

export const KEYBINDING_DEFINITION_PANE_DIRECTION: readonly KeybindingDefinition[] = [
  {
    id: 'terminal.focusPaneLeft',
    title: 'Focus pane to the left',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'focus', 'split', 'navigate', 'left', 'direction'],
    defaultBindings: { darwin: ['Mod+Alt+ArrowLeft'], linux: [], win32: [] }
  },
  {
    id: 'terminal.focusPaneRight',
    title: 'Focus pane to the right',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'focus', 'split', 'navigate', 'right', 'direction'],
    defaultBindings: { darwin: ['Mod+Alt+ArrowRight'], linux: [], win32: [] }
  },
  {
    id: 'terminal.focusPaneUp',
    title: 'Focus pane above',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'focus', 'split', 'navigate', 'up', 'direction'],
    defaultBindings: { darwin: ['Mod+Alt+ArrowUp'], linux: [], win32: [] }
  },
  {
    id: 'terminal.focusPaneDown',
    title: 'Focus pane below',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'focus', 'split', 'navigate', 'down', 'direction'],
    defaultBindings: { darwin: ['Mod+Alt+ArrowDown'], linux: [], win32: [] }
  }
]
