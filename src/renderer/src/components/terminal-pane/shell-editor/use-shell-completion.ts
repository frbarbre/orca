import { useRef, useState } from 'react'
import {
  applyCompletion,
  filterCompletionMenu,
  moveCompletionSelection,
  openCompletionMenu,
  resolveCompletionMenuKey,
  type CompletionMenu,
  type ShellCompletion
} from './shell-editor-completion'
import { replaceShellEditorText } from './shell-editor-dom'

export type ShellCompletionControls = {
  menu: CompletionMenu | null
  request: (field: HTMLTextAreaElement) => void
  accept: (entry: ShellCompletion) => void
  /** True when the open menu took the key. */
  handleKey: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  /** Typing narrows the open menu instead of asking zsh again. */
  narrow: (field: HTMLTextAreaElement) => void
  close: () => void
  warm: () => void
}

/** Warp-style Tab completion: zsh's candidates in a menu over the input. */
export function useShellCompletion(
  fieldRef: React.RefObject<HTMLTextAreaElement | null>,
  cwd: string | null
): ShellCompletionControls {
  const [menu, setMenu] = useState<CompletionMenu | null>(null)
  const requestId = useRef(0)
  const warmed = useRef(false)

  const accept = (entry: ShellCompletion): void => {
    const field = fieldRef.current
    setMenu(null)
    if (!field) {
      return
    }
    const next = applyCompletion(field.value, field.selectionEnd, entry.value)
    replaceShellEditorText(field, next.text)
    field.setSelectionRange(next.caret, next.caret)
  }

  const request = (field: HTMLTextAreaElement): void => {
    const caret = field.selectionEnd
    const line = field.value.slice(0, caret)
    if (!cwd || field.selectionStart !== caret || line.includes('\n') || !line.trim()) {
      return
    }
    const id = ++requestId.current
    void window.api.shellEditor.complete({ cwd, line }).then((items) => {
      if (id !== requestId.current || field.value.slice(0, field.selectionEnd) !== line) {
        return
      }
      if (items.length === 1) {
        accept(items[0])
        return
      }
      setMenu(openCompletionMenu(items, field.value, caret))
    })
  }

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!menu) {
      return false
    }
    const action = resolveCompletionMenuKey(event)
    if (!action) {
      return false
    }
    event.preventDefault()
    if (action === 'accept') {
      accept(menu.visible[menu.selected])
    } else if (action === 'close') {
      setMenu(null)
    } else {
      setMenu(moveCompletionSelection(menu, action === 'next' ? 1 : -1))
    }
    return true
  }

  return {
    menu,
    request,
    accept,
    handleKey,
    narrow: (field) => {
      setMenu(
        (current) => current && filterCompletionMenu(current, field.value, field.selectionEnd)
      )
    },
    close: () => {
      requestId.current++
      setMenu(null)
    },
    warm: () => {
      if (!warmed.current) {
        warmed.current = true
        void window.api.shellEditor.warmCompletion()
      }
    }
  }
}
