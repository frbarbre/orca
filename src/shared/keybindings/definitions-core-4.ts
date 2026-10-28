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
  {
    id: 'editor.showEdit',
    title: 'Show File Editor',
    group: 'Editors',
    scope: 'editor',
    searchKeywords: ['shortcut', 'editor', 'diff', 'edit', 'file', 'view', 'toggle', 'source'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+E'], linux: [], win32: [] }
  },
  {
    id: 'editor.showDiff',
    title: 'Show File Diff',
    group: 'Editors',
    scope: 'editor',
    searchKeywords: ['shortcut', 'editor', 'diff', 'changes', 'file', 'view', 'toggle'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+D'], linux: [], win32: [] }
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
    id: 'chat.find',
    title: 'Find in chat',
    group: 'Chat',
    scope: 'chat',
    searchKeywords: ['shortcut', 'chat', 'find', 'search'],
    defaultBindings: platformBindings(['Mod+F'])
  },
  {
    id: 'sidebar.childWorkspaces.toggle',
    title: 'Toggle Child Workspaces',
    group: 'Global',
    scope: 'global',
    searchKeywords: [
      'shortcut',
      'sidebar',
      'child',
      'children',
      'nested',
      'lineage',
      'workspaces',
      'worktree',
      'collapse',
      'expand',
      'show',
      'hide'
    ],
    // Why: ship unbound like the sleeping toggle, so no existing chord is claimed on any platform.
    defaultBindings: platformBindings([])
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
  },
  {
    id: 'sourceControl.openLatestAgentTurn',
    title: 'Open Latest Agent Turn',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'source control', 'agent', 'turn', 'diff', 'latest', 'snapshot'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+Shift+T'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.toggleUncommittedOnly',
    title: 'Show Only Uncommitted Changes',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'source control', 'changes', 'uncommitted', 'filter', 'working'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+U'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.sendQueuedComments',
    title: 'Send Queued Comments',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'pull request', 'comments', 'queued', 'send', 'agent', 'review'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+S'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.focusReviewSummary',
    title: 'Focus Review Summary',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'source control', 'review', 'summary', 'focus', 'pull request'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+Shift+R'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.openPullRequest',
    title: 'Open Pull Request on GitHub',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'pull request', 'github', 'open', 'browser', 'review'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+G'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.copyPullRequestUrl',
    title: 'Copy Pull Request URL',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'pull request', 'github', 'copy', 'url', 'link'],
    // Why macOS only: Ctrl+Alt+letter is AltGr text input on Windows and Linux.
    defaultBindings: { darwin: ['Mod+Alt+Shift+G'], linux: [], win32: [] }
  },
  {
    id: 'sourceControl.openPullRequestPreview',
    title: 'Open Pull Request Preview Deployment',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'pull request', 'preview', 'deployment', 'browser', 'open'],
    defaultBindings: platformBindings(['Mod+Shift+P'])
  },
  {
    id: 'workspace.openFrontend',
    title: 'Open Frontend Dev Server',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'frontend', 'dev server', 'browser', 'open', 'localhost'],
    defaultBindings: platformBindings(['Mod+Shift+B'])
  },
  {
    id: 'workspace.runNextAction',
    title: 'Run Next Workspace Action',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: [
      'shortcut',
      'next action',
      'create pr',
      'commit',
      'push',
      'ready for review',
      'merge',
      'auto-merge'
    ],
    defaultBindings: platformBindings(['Mod+Alt+Enter'])
  },
  {
    id: 'workspace.review',
    title: 'Review Pull Request',
    group: 'Global',
    scope: 'global',
    conflictGroup: 'editor',
    searchKeywords: ['shortcut', 'review', 'pull request', 'pr', 'agent'],
    defaultBindings: platformBindings(['Mod+Alt+Shift+Enter'])
  }
]
