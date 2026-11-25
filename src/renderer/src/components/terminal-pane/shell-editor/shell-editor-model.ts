import { wrapTerminalBracketedPasteText } from '../../../../../shared/terminal-bracketed-paste-text'

export type ShellEditorPromptInfo = {
  branch: string | null
  histfile: string | null
  cwd: string
}

const PROMPT_INFO_PREFIX = 'orca-shell-editor;'
const CLEAR_LINE = '\u0015'

/** Reads the `branch;histfile;cwd` payload Orca's zsh hook prints before each editor prompt. */
export function parseShellEditorPromptInfo(payload: string): ShellEditorPromptInfo | null {
  if (!payload.startsWith(PROMPT_INFO_PREFIX)) {
    return null
  }
  const [branch, histfile, ...cwd] = payload.slice(PROMPT_INFO_PREFIX.length).split(';')
  if (cwd.length === 0) {
    return null
  }
  return { branch: branch || null, histfile: histfile || null, cwd: cwd.join(';') }
}

// Why Ctrl+U first: anything typed straight into the terminal would otherwise prefix the command.
export function encodeShellEditorCommand(text: string): string {
  const body = text.includes('\n') ? wrapTerminalBracketedPasteText(text) : text
  return `${CLEAR_LINE}${body}\r`
}

export function encodeShellEditorHandoff(text: string, key: string): string {
  return `${CLEAR_LINE}${text}${key}`
}

export type ShellEditorKeyAction =
  | 'submit'
  | 'historyPrevious'
  | 'historyNext'
  | 'clear'
  | 'eof'
  | 'clearScreen'
  | 'handoffSearch'
  | 'handoffComplete'

export function resolveShellEditorKey(input: {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  caretOnFirstLine: boolean
  caretOnLastLine: boolean
  empty: boolean
}): ShellEditorKeyAction | null {
  const plain = !input.shiftKey && !input.ctrlKey && !input.metaKey && !input.altKey
  if (plain) {
    switch (input.key) {
      case 'Enter':
        return 'submit'
      case 'Tab':
        return 'handoffComplete'
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

export type ShellEditorHistory = {
  /** The entry before the current one that starts with the draft, or null at the oldest. */
  previous: (current: string) => string | null
  /** The newer entry, the draft once past the newest, or null when already on the draft. */
  next: () => string | null
  record: (command: string) => void
  replace: (entries: readonly string[]) => void
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
    }
  }
}
