import type { KeybindingDefinition } from './types'
import { platformBindings } from './definitions-support'

export const KEYBINDING_DEFINITION_CORE_4: readonly KeybindingDefinition[] = [
  // Why: change navigation stops at the file boundary, so reviewing a branch needs a file-level
  // step too. Alt+F7 keeps the F7 family without colliding with Monaco's own bare/Shift F7 review
  // pane; the allow-flags let a user rebind these to bare or Shift-prefixed keys such as
  // Shift+ArrowDown, which reads naturally next to a bare-arrow change navigation binding.
  {
    id: 'editor.previousFile',
    title: 'Go to Previous Changed File',
    group: 'Editors',
    scope: 'editor',
    searchKeywords: ['shortcut', 'editor', 'diff', 'file', 'previous', 'review'],
    defaultBindings: platformBindings(['Alt+Shift+F7']),
    allowBareKeybindings: true,
    allowShiftOnlyKeybindings: true
  },
  {
    id: 'editor.nextFile',
    title: 'Go to Next Changed File',
    group: 'Editors',
    scope: 'editor',
    searchKeywords: ['shortcut', 'editor', 'diff', 'file', 'next', 'review'],
    defaultBindings: platformBindings(['Alt+F7']),
    allowBareKeybindings: true,
    allowShiftOnlyKeybindings: true
  },
  // Why global scope: the chord has to work from the Explorer and the Source Control listing as
  // well as the editor, because which of those is on screen is what decides the path it opens.
  {
    id: 'editor.openInExternalApp',
    title: 'Open in External App',
    group: 'Editors',
    scope: 'global',
    searchKeywords: ['shortcut', 'open', 'external', 'editor', 'vscode', 'cursor', 'reveal'],
    defaultBindings: platformBindings(['Mod+O'])
  },
  {
    id: 'terminal.clearPaneTitle',
    title: 'Clear Pane Title',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'terminal', 'pane', 'clear title', 'remove title', 'title'],
    defaultBindings: platformBindings([])
  },
  {
    id: 'terminal.closePane',
    title: 'Close active pane',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'close'],
    defaultBindings: platformBindings(['Mod+W'])
  },
  {
    id: 'terminal.splitRight',
    title: 'Split terminal right',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'split', 'right'],
    defaultBindings: {
      darwin: ['Mod+D'],
      linux: ['Mod+Shift+D'],
      win32: ['Mod+Shift+D']
    }
  },
  {
    id: 'terminal.splitDown',
    title: 'Split terminal down',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: ['shortcut', 'pane', 'split', 'down'],
    defaultBindings: {
      darwin: ['Mod+Shift+D'],
      linux: ['Alt+Shift+D'],
      win32: ['Alt+Shift+D']
    }
  },
  {
    id: 'terminal.switchInputSource',
    title: 'Switch input source / language (native)',
    group: 'Terminal Panes',
    scope: 'terminal',
    searchKeywords: [
      'shortcut',
      'input',
      'source',
      'language',
      'korean',
      'english',
      'ime',
      'switch',
      'hangul',
      'layout'
    ],
    defaultBindings: {
      darwin: [],
      linux: [],
      win32: []
    },
    // Why: macOS uses Shift+Space as an input-source shortcut; Orca otherwise rejects Shift-only bindings to avoid stealing typed text.
    allowShiftOnlyKeybindings: true
  }
]
