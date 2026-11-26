export type ShellCompletion = { value: string; description: string | null; tag: string | null }

export type ShellCompletionKind = 'folder' | 'file' | 'command' | 'option' | 'other'

export type CompletionMenu = {
  items: ShellCompletion[]
  visible: ShellCompletion[]
  /** -1 until the user moves into the list, as in Warp. */
  selected: number
  wordStart: number
  /** The line as typed, before any pick was previewed in it. */
  original: { text: string; caret: number }
}

const COMMAND_TAGS = new Set(['builtins', 'functions', 'aliases', 'reserved-words'])

export function completionKind(entry: ShellCompletion): ShellCompletionKind {
  const tag = entry.tag ?? ''
  if (entry.value.endsWith('/') || tag.includes('director')) {
    return 'folder'
  }
  if (tag.includes('file')) {
    return 'file'
  }
  if (tag.endsWith('commands') || COMMAND_TAGS.has(tag)) {
    return 'command'
  }
  if (tag.includes('option')) {
    return 'option'
  }
  return 'other'
}

/** The last part of a path, keeping a folder's slash; the detail card shows the whole value. */
export function completionLabel(value: string): string {
  const trimmed = value.endsWith('/') ? value.slice(0, -1) : value
  const at = trimmed.lastIndexOf('/')
  return at === -1 ? value : value.slice(at + 1)
}

/** Where the word being completed starts; a backslash-escaped space stays inside it. */
export function completionWordStart(text: string, caret: number): number {
  let at = caret
  while (at > 0) {
    const before = text[at - 1]
    if (/\s/.test(before) && text[at - 2] !== '\\') {
      break
    }
    at--
  }
  return at
}

function replaceWord(
  text: string,
  caret: number,
  inserted: string
): { text: string; caret: number } {
  const start = completionWordStart(text, caret)
  return {
    text: `${text.slice(0, start)}${inserted}${text.slice(caret)}`,
    caret: start + inserted.length
  }
}

export function applyCompletion(
  text: string,
  caret: number,
  value: string
): { text: string; caret: number } {
  const space = value.endsWith('/') || /^\s/.test(text.slice(caret)) ? '' : ' '
  return replaceWord(text, caret, `${value}${space}`)
}

export function openCompletionMenu(
  items: ShellCompletion[],
  text: string,
  caret: number
): CompletionMenu | null {
  if (items.length === 0) {
    return null
  }
  const sorted = [...items].sort((a, b) => a.value.localeCompare(b.value))
  return {
    items: sorted,
    visible: sorted,
    selected: -1,
    wordStart: completionWordStart(text, caret),
    original: { text, caret }
  }
}

/** Typing narrows the list to what still fits; what was typed becomes the line to return to. */
export function filterCompletionMenu(
  menu: CompletionMenu,
  text: string,
  caret: number
): CompletionMenu | null {
  if (completionWordStart(text, caret) !== menu.wordStart) {
    return null
  }
  const word = text.slice(menu.wordStart, caret)
  const visible = menu.items.filter((entry) => entry.value.startsWith(word))
  if (visible.length === 0) {
    return null
  }
  return { ...menu, visible, selected: -1, original: { text, caret } }
}

export function moveCompletionSelection(menu: CompletionMenu, delta: number): CompletionMenu {
  const count = menu.visible.length
  if (menu.selected === -1) {
    return { ...menu, selected: delta > 0 ? 0 : count - 1 }
  }
  return { ...menu, selected: (((menu.selected + delta) % count) + count) % count }
}

/** The line with the pick in place of the word, as Warp shows it while moving through the list. */
export function previewCompletion(menu: CompletionMenu): { text: string; caret: number } | null {
  const picked = menu.visible[menu.selected]
  if (!picked) {
    return null
  }
  return replaceWord(menu.original.text, menu.original.caret, picked.value)
}

export function resolveCompletionMenuKey(input: {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): 'next' | 'previous' | 'accept' | 'close' | null {
  if (input.ctrlKey || input.metaKey || input.altKey) {
    return null
  }
  switch (input.key) {
    case 'ArrowDown':
      return 'next'
    case 'ArrowUp':
      return 'previous'
    case 'Tab':
      return input.shiftKey ? 'previous' : 'next'
    case 'Enter':
      return input.shiftKey ? null : 'accept'
    case 'Escape':
      return 'close'
  }
  return null
}
