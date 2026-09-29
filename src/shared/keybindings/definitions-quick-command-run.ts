import type { KeybindingDefinition } from './types'

export const KEYBINDING_DEFINITION_QUICK_COMMAND_RUN: readonly KeybindingDefinition[] = [
  {
    id: 'tab.runQuickCommand',
    title: 'Run the selected quick command',
    group: 'Tabs',
    scope: 'tabs',
    conflictGroup: 'workspace-shell',
    searchKeywords: ['shortcut', 'run', 'script', 'quick command', 'play'],
    // Why unbound: Cmd+R is the stock rename shortcut, and Ctrl+R is the shell's reverse search.
    defaultBindings: { darwin: [], linux: [], win32: [] }
  }
]
