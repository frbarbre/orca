import { wrapTerminalBracketedPasteText } from '../../../../../shared/terminal-bracketed-paste-text'
import type { TerminalShortcutAction } from '../terminal-shortcut-policy'

export type ShellEditorPromptInfo = {
  branch: string | null
  histfile: string | null
  node: string | null
  cwd: string
}

const PROMPT_INFO_PREFIX = 'orca-shell-editor;'
// Why a second prefix: a daemon from an older install still prints the report without node.
const PROMPT_INFO_V2_PREFIX = 'orca-shell-editor2;'
const CLEAR_LINE = '\u0015'

/** Reads the report Orca's zsh hook prints before each editor prompt; the folder comes last and may hold `;`. */
export function parseShellEditorPromptInfo(payload: string): ShellEditorPromptInfo | null {
  const v2 = payload.startsWith(PROMPT_INFO_V2_PREFIX)
  if (!v2 && !payload.startsWith(PROMPT_INFO_PREFIX)) {
    return null
  }
  const fields = payload.slice((v2 ? PROMPT_INFO_V2_PREFIX : PROMPT_INFO_PREFIX).length).split(';')
  const [branch, histfile, ...rest] = fields
  const [node, ...cwd] = v2 ? rest : [null, ...rest]
  if (cwd.length === 0) {
    return null
  }
  return {
    branch: branch || null,
    histfile: histfile || null,
    node: node || null,
    cwd: cwd.join(';')
  }
}

// Why Ctrl+U first: anything typed straight into the terminal would otherwise prefix the command.
export function encodeShellEditorCommand(text: string): string {
  const body = text.includes('\n') ? wrapTerminalBracketedPasteText(text) : text
  return `${CLEAR_LINE}${body}\r`
}

export function encodeShellEditorHandoff(text: string, key: string): string {
  return `${CLEAR_LINE}${text}${key}`
}

const PANE_SHORTCUTS: ReadonlySet<TerminalShortcutAction['type']> = new Set([
  'splitActivePane',
  'openTerminalGroup',
  'closeActivePane',
  'focusPane',
  'equalizePaneSizes',
  'toggleExpandActivePane',
  'clearActivePane',
  'toggleSearch'
])

/** Terminal shortcuts that still act from the editor; the rest stay text editing or pty input. */
export function isShellEditorPaneShortcut(action: TerminalShortcutAction | null): boolean {
  return action !== null && PANE_SHORTCUTS.has(action.type)
}

export type ShellEditorKeyAction =
  | 'submit'
  | 'historyPrevious'
  | 'historyNext'
  | 'clear'
  | 'eof'
  | 'clearScreen'
  | 'handoffSearch'
  | 'complete'
  | 'acceptSuggestion'
  | 'acceptSuggestionWord'

export function resolveShellEditorKey(input: {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  caretOnFirstLine: boolean
  caretOnLastLine: boolean
  caretAtEnd: boolean
  hasSuggestion: boolean
  empty: boolean
}): ShellEditorKeyAction | null {
  const plain = !input.shiftKey && !input.ctrlKey && !input.metaKey && !input.altKey
  if (input.key === 'ArrowRight' && input.caretAtEnd && input.hasSuggestion) {
    const altOnly = input.altKey && !input.shiftKey && !input.ctrlKey && !input.metaKey
    if (plain) {
      return 'acceptSuggestion'
    }
    if (altOnly) {
      return 'acceptSuggestionWord'
    }
  }
  if (plain) {
    switch (input.key) {
      case 'Enter':
        return 'submit'
      case 'Tab':
        return 'complete'
      case 'ArrowUp':
        return input.caretOnFirstLine ? 'historyPrevious' : null
      case 'ArrowDown':
        return input.caretOnLastLine ? 'historyNext' : null
    }
    return null
  }
  const ctrlOnly = input.ctrlKey && !input.shiftKey && !input.metaKey && !input.altKey
  if (!ctrlOnly) {
    return null
  }
  switch (input.key.toLowerCase()) {
    case 'c':
      return 'clear'
    case 'd':
      return input.empty ? 'eof' : null
    case 'l':
      return 'clearScreen'
    case 'r':
      return 'handoffSearch'
  }
  return null
}

/** Runs an empty line, so an idle zsh prints a fresh prompt report. */
export const SHELL_EDITOR_NUDGE = `${CLEAR_LINE}\r`

function isZshProcess(name: string): boolean {
  return name.split('/').pop()?.replace(/^-/, '') === 'zsh'
}

// Why: markers printed while a pane is hidden or parked never reach its terminal, so a revealed pane checks the shell.
export function resolveShellEditorResync(input: {
  phase: 'off' | 'starting' | 'prompt' | 'running' | 'handoff'
  foregroundProcess: string | null
  nudged: boolean
}): 'nudge' | 'running' | null {
  if (!input.foregroundProcess) {
    return null
  }
  const idle = isZshProcess(input.foregroundProcess)
  if (input.phase === 'prompt') {
    return idle ? null : 'running'
  }
  if ((input.phase === 'off' || input.phase === 'running') && idle && !input.nudged) {
    return 'nudge'
  }
  return null
}

export type ShellEditorHistory = {
  /** The entry before the current one that starts with the draft, or null at the oldest. */
  previous: (current: string) => string | null
  /** The newer entry, the draft once past the newest, or null when already on the draft. */
  next: () => string | null
  record: (command: string) => void
  replace: (entries: readonly string[]) => void
  suggest: (typed: string) => string | null
}

export function nextSuggestionWord(suggestion: string): string {
  return /^\s*\S*/.exec(suggestion)?.[0] ?? ''
}

export function createShellEditorHistory(initial: readonly string[]): ShellEditorHistory {
  let fileEntries = [...initial]
  let recorded: string[] = []
  let index: number | null = null
  let draft = ''

  const entries = (): string[] => [...fileEntries, ...recorded]
  const matches = (entry: string): boolean => entry.startsWith(draft) && entry !== draft

  return {
    previous(current) {
      const list = entries()
      if (index === null) {
        draft = current
      }
      for (let at = (index ?? list.length) - 1; at >= 0; at--) {
        if (matches(list[at])) {
          index = at
          return list[at]
        }
      }
      return null
    },
    next() {
      if (index === null) {
        return null
      }
      const list = entries()
      for (let at = index + 1; at < list.length; at++) {
        if (matches(list[at])) {
          index = at
          return list[at]
        }
      }
      index = null
      return draft
    },
    record(command) {
      recorded = [...recorded.filter((entry) => entry !== command), command]
      index = null
    },
    replace(next) {
      const fresh = new Set(next)
      fileEntries = [...next]
      recorded = recorded.filter((entry) => !fresh.has(entry))
    },
    suggest(typed) {
      if (typed === '' || typed.includes('\n')) {
        return null
      }
      const list = entries()
      for (let at = list.length - 1; at >= 0; at--) {
        const entry = list[at]
        if (entry.startsWith(typed) && entry !== typed && !entry.includes('\n')) {
          return entry.slice(typed.length)
        }
      }
      return null
    }
  }
}
