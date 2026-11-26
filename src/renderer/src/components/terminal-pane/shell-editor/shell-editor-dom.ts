import type { TerminalShortcutAction } from '../terminal-shortcut-policy'
import { isShellEditorPaneShortcut } from './shell-editor-model'

export const SHELL_EDITOR_ROOT_ATTRIBUTE = 'data-shell-editor-root'

export function isInsideShellEditor(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${SHELL_EDITOR_ROOT_ATTRIBUTE}]`) !== null
}

/** The editor's field stands in for the terminal, so pane shortcuts still work from it. */
export function isShellEditorPaneShortcutEvent(
  target: EventTarget | null,
  resolveAction: () => TerminalShortcutAction | null
): boolean {
  return isInsideShellEditor(target) && isShellEditorPaneShortcut(resolveAction())
}

export type ShellEditorCaret = {
  caretOnFirstLine: boolean
  caretOnLastLine: boolean
  caretAtEnd: boolean
}

/** History keys only act on a collapsed caret at the field's first or last line. */
export function readShellEditorCaret(field: {
  value: string
  selectionStart: number
  selectionEnd: number
}): ShellEditorCaret {
  if (field.selectionStart !== field.selectionEnd) {
    return { caretOnFirstLine: false, caretOnLastLine: false, caretAtEnd: false }
  }
  return {
    caretOnFirstLine: !field.value.slice(0, field.selectionStart).includes('\n'),
    caretOnLastLine: !field.value.slice(field.selectionEnd).includes('\n'),
    caretAtEnd: field.selectionEnd === field.value.length
  }
}

/** Types at the end of the field as one undoable edit. */
export function appendShellEditorText(field: HTMLTextAreaElement, text: string): void {
  field.focus()
  field.setSelectionRange(field.value.length, field.value.length)
  if (!document.execCommand('insertText', false, text)) {
    field.value += text
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

/** Replaces the field's text as one undoable edit, so ⌘Z brings back what history replaced. */
export function replaceShellEditorText(field: HTMLTextAreaElement, text: string): void {
  field.focus()
  field.select()
  if (!document.execCommand('insertText', false, text)) {
    field.value = text
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }
  field.setSelectionRange(text.length, text.length)
}

/** Shortens the home folder to ~ the way zsh's prompt does. */
export function displayShellEditorCwd(cwd: string): string {
  return cwd.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~')
}
