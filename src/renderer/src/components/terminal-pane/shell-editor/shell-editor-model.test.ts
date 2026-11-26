import { describe, expect, it } from 'vitest'
import {
  createShellEditorHistory,
  encodeShellEditorCommand,
  encodeShellEditorHandoff,
  nextSuggestionWord,
  parseShellEditorPromptInfo,
  resolveShellEditorKey,
  resolveShellEditorResync
} from './shell-editor-model'

describe('parseShellEditorPromptInfo', () => {
  it('reads the branch, history file and folder, keeping semicolons in the folder', () => {
    expect(
      parseShellEditorPromptInfo('orca-shell-editor;feat/x;/Users/me/.zsh_history;/a;b')
    ).toEqual({ branch: 'feat/x', histfile: '/Users/me/.zsh_history', node: null, cwd: '/a;b' })
  })

  it('reads the node version from the newer report', () => {
    expect(
      parseShellEditorPromptInfo('orca-shell-editor2;main;/h/.zsh_history;v24.14.0;/a;b')
    ).toEqual({ branch: 'main', histfile: '/h/.zsh_history', node: 'v24.14.0', cwd: '/a;b' })
  })

  it('treats empty fields as missing', () => {
    expect(parseShellEditorPromptInfo('orca-shell-editor;;;/tmp')).toEqual({
      branch: null,
      histfile: null,
      node: null,
      cwd: '/tmp'
    })
    expect(parseShellEditorPromptInfo('orca-shell-editor2;;;;/tmp')).toMatchObject({ node: null })
  })

  it('ignores other OSC 777 messages', () => {
    expect(parseShellEditorPromptInfo('orca-shell-start:123')).toBeNull()
    expect(parseShellEditorPromptInfo('orca-shell-editor;x')).toBeNull()
  })
})

describe('encodeShellEditorCommand', () => {
  it('clears zsh’s line, then types and runs a one-line command', () => {
    expect(encodeShellEditorCommand('git status')).toBe('\u0015git status\r')
  })

  it('sends a multi-line command as one paste so zsh runs it once', () => {
    expect(encodeShellEditorCommand('echo a\necho b')).toBe(
      '\u0015\u001b[200~echo a\recho b\u001b[201~\r'
    )
  })

  it('hands a line to zsh with the key that asked for it', () => {
    expect(encodeShellEditorHandoff('git che', '\t')).toBe('\u0015git che\t')
  })
})

describe('resolveShellEditorKey', () => {
  const base = {
    key: 'a',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    caretOnFirstLine: true,
    caretOnLastLine: true,
    caretAtEnd: false,
    hasSuggestion: false,
    empty: false
  }

  it('accepts a suggestion with → and its next word with ⌥→, only from the end of the line', () => {
    const atEnd = { ...base, key: 'ArrowRight', caretAtEnd: true, hasSuggestion: true }
    expect(resolveShellEditorKey(atEnd)).toBe('acceptSuggestion')
    expect(resolveShellEditorKey({ ...atEnd, altKey: true })).toBe('acceptSuggestionWord')
    expect(resolveShellEditorKey({ ...atEnd, caretAtEnd: false })).toBeNull()
    expect(resolveShellEditorKey({ ...atEnd, hasSuggestion: false })).toBeNull()
    expect(resolveShellEditorKey({ ...atEnd, shiftKey: true })).toBeNull()
  })

  it('runs on Enter and adds a line on Shift+Enter', () => {
    expect(resolveShellEditorKey({ ...base, key: 'Enter' })).toBe('submit')
    expect(resolveShellEditorKey({ ...base, key: 'Enter', shiftKey: true })).toBeNull()
  })

  it('walks history only from the first or last line', () => {
    expect(resolveShellEditorKey({ ...base, key: 'ArrowUp' })).toBe('historyPrevious')
    expect(resolveShellEditorKey({ ...base, key: 'ArrowDown' })).toBe('historyNext')
    expect(resolveShellEditorKey({ ...base, key: 'ArrowUp', caretOnFirstLine: false })).toBeNull()
    expect(resolveShellEditorKey({ ...base, key: 'ArrowDown', caretOnLastLine: false })).toBeNull()
    expect(resolveShellEditorKey({ ...base, key: 'ArrowUp', shiftKey: true })).toBeNull()
  })

  it('maps the shell control keys', () => {
    expect(resolveShellEditorKey({ ...base, key: 'c', ctrlKey: true })).toBe('clear')
    expect(resolveShellEditorKey({ ...base, key: 'd', ctrlKey: true, empty: true })).toBe('eof')
    expect(resolveShellEditorKey({ ...base, key: 'd', ctrlKey: true })).toBeNull()
    expect(resolveShellEditorKey({ ...base, key: 'l', ctrlKey: true })).toBe('clearScreen')
    expect(resolveShellEditorKey({ ...base, key: 'r', ctrlKey: true })).toBe('handoffSearch')
    expect(resolveShellEditorKey({ ...base, key: 'Tab' })).toBe('handoffComplete')
  })

  it('leaves normal editing keys to the text field', () => {
    for (const key of ['z', 'a', 'ArrowLeft', 'Backspace']) {
      expect(resolveShellEditorKey({ ...base, key, metaKey: true })).toBeNull()
    }
    expect(resolveShellEditorKey({ ...base, key: 'a', ctrlKey: true })).toBeNull()
    expect(resolveShellEditorKey({ ...base, key: 'Tab', shiftKey: true })).toBeNull()
  })
})

describe('resolveShellEditorResync', () => {
  type Phase = Parameters<typeof resolveShellEditorResync>[0]['phase']
  const resync = (phase: Phase, foregroundProcess: string | null, nudged = false) =>
    resolveShellEditorResync({ phase, foregroundProcess, nudged })

  it('asks an idle zsh for a fresh prompt report once when the box lost track of it', () => {
    expect(resync('off', 'zsh')).toBe('nudge')
    expect(resync('running', 'zsh')).toBe('nudge')
    expect(resync('off', '-zsh')).toBe('nudge')
    expect(resync('off', '/bin/zsh', true)).toBeNull()
  })

  it('hides the box when a command took over while the pane was hidden', () => {
    expect(resync('prompt', 'vim')).toBe('running')
  })

  it('leaves zsh alone while it starts, holds a handed-off line, or is already known', () => {
    expect(resync('starting', 'zsh')).toBeNull()
    expect(resync('handoff', 'zsh')).toBeNull()
    expect(resync('prompt', 'zsh')).toBeNull()
    expect(resync('off', 'node')).toBeNull()
    expect(resync('off', null)).toBeNull()
  })
})

describe('suggestions', () => {
  it('suggests the rest of the newest command that starts with what is typed', () => {
    const history = createShellEditorHistory(['git status', 'git stash pop', 'ls'])
    expect(history.suggest('git st')).toBe('ash pop')
    history.record('git status --short')
    expect(history.suggest('git st')).toBe('atus --short')
  })

  it('suggests nothing for an empty or multi-line draft, an exact match or a multi-line entry', () => {
    const history = createShellEditorHistory(['ls', 'for f in a\ndo echo $f\ndone'])
    expect(history.suggest('')).toBeNull()
    expect(history.suggest('ls')).toBeNull()
    expect(history.suggest('l\ns')).toBeNull()
    expect(history.suggest('for')).toBeNull()
  })

  it('takes one word at a time, with the space in front of it', () => {
    expect(nextSuggestionWord('ash pop --index')).toBe('ash')
    expect(nextSuggestionWord(' pop --index')).toBe(' pop')
    expect(nextSuggestionWord('')).toBe('')
  })
})

describe('createShellEditorHistory', () => {
  it('walks back and forward, restoring the draft at the end', () => {
    const history = createShellEditorHistory(['ls', 'git status', 'pnpm test'])
    expect(history.previous('')).toBe('pnpm test')
    expect(history.previous('pnpm test')).toBe('git status')
    expect(history.next()).toBe('pnpm test')
    expect(history.next()).toBe('')
    expect(history.next()).toBeNull()
  })

  it('only offers entries starting with what was typed', () => {
    const history = createShellEditorHistory(['git log', 'ls', 'git status'])
    expect(history.previous('git')).toBe('git status')
    expect(history.previous('git status')).toBe('git log')
    expect(history.previous('git log')).toBeNull()
    expect(history.next()).toBe('git status')
    expect(history.next()).toBe('git')
  })

  it('remembers commands run from the editor and starts over after one', () => {
    const history = createShellEditorHistory(['ls'])
    history.previous('')
    history.record('make')
    expect(history.previous('')).toBe('make')
    expect(history.previous('make')).toBe('ls')
  })

  it('takes a newer history file without losing commands run since', () => {
    const history = createShellEditorHistory([])
    history.record('make')
    history.replace(['ls', 'git status'])
    expect(history.previous('')).toBe('make')
    expect(history.previous('make')).toBe('git status')
  })
})
