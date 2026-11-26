export type ShellCompletion = { value: string; description: string | null }

export type CompletionMenu = {
  items: ShellCompletion[]
  visible: ShellCompletion[]
  selected: number
  wordStart: number
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

export function applyCompletion(
  text: string,
  caret: number,
  value: string
): { text: string; caret: number } {
  const start = completionWordStart(text, caret)
  const rest = text.slice(caret)
  const space = value.endsWith('/') || /^\s/.test(rest) ? '' : ' '
  const inserted = `${value}${space}`
  return {
    text: `${text.slice(0, start)}${inserted}${rest}`,
    caret: start + inserted.length
  }
}

export function openCompletionMenu(
  items: ShellCompletion[],
  text: string,
  caret: number
): CompletionMenu | null {
  if (items.length === 0) {
    return null
  }
  return { items, visible: items, selected: 0, wordStart: completionWordStart(text, caret) }
}

/** Keeps the entries that still start with the word, as Warp narrows its menu while typing. */
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
  const picked = menu.visible[menu.selected]
  const selected = picked ? Math.max(0, visible.indexOf(picked)) : 0
  return { ...menu, visible, selected }
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

export function moveCompletionSelection(menu: CompletionMenu, delta: number): CompletionMenu {
  const count = menu.visible.length
  return { ...menu, selected: (((menu.selected + delta) % count) + count) % count }
}
