import type { KeybindingActionId } from '../../../../shared/keybindings'
import { useAppStore } from '../../store'

/**
 * Keeps diff review shortcuts working while keyboard focus is outside the diff editor.
 *
 * Why: change, file and review-note shortcuts listen on the diff editor's own container, so they
 * went dead the moment focus left it — after writing a comment, or while working in the Source
 * Control panel. This window-level fallback hands them back to the mounted diff editor.
 */

type MountedDiffEditor = {
  /** The modified side's container: the review-note listener sits on it, the others above it. */
  getShortcutTarget: () => HTMLElement
  focus: () => void
}

const REVIEW_SHORTCUTS = [
  'editor.nextChange',
  'editor.previousChange',
  'editor.nextFile',
  'editor.previousFile',
  'editor.addReviewNote'
] as const satisfies readonly KeybindingActionId[]

let mounted: MountedDiffEditor | null = null
// Why: the copy dispatched to the editor passes back through the window listener that called us.
let redispatching = false

/** Returns the unregister function; a stale one never clears a newer editor. */
export function registerDiffEditorForOutsideShortcuts(editor: MountedDiffEditor): () => void {
  mounted = editor
  return () => {
    if (mounted === editor) {
      mounted = null
    }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null
  return (
    element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !=
    null
  )
}

function isNothingFocused(target: EventTarget | null): boolean {
  return target === null || target === document.body || target === document.documentElement
}

function isDiffPanelOpen(): boolean {
  const state = useAppStore.getState()
  if (state.rightSidebarOpen && state.rightSidebarTab === 'source-control') {
    return true
  }
  const activeFile = state.openFiles.find((file) => file.id === state.activeFileId)
  return state.activeTabType === 'editor' && activeFile?.mode === 'diff'
}

function redispatch(event: KeyboardEvent, target: HTMLElement): boolean {
  const copy = new KeyboardEvent('keydown', {
    key: event.key,
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    repeat: event.repeat,
    bubbles: true,
    cancelable: true
  })
  redispatching = true
  try {
    target.dispatchEvent(copy)
  } finally {
    redispatching = false
  }
  return copy.defaultPrevented
}

/** Returns true when the chord was consumed. */
export function handleDiffShortcutOutsideEditor(
  event: KeyboardEvent,
  matchShortcut: (actionId: KeybindingActionId) => boolean
): boolean {
  const actionId = redispatching ? undefined : REVIEW_SHORTCUTS.find((id) => matchShortcut(id))
  if (!actionId) {
    return false
  }
  // Why: an editor-focused press is the editor's own listener's to handle, and a press while
  // typing (a comment, a search box, the terminal's helper textarea) is text, not navigation.
  if (event.target instanceof Element && event.target.closest('.monaco-editor')) {
    return false
  }
  if (isTypingTarget(event.target) || !isDiffPanelOpen()) {
    return false
  }
  // Why: a binding without Cmd/Ctrl/Alt (bare arrows are a common choice here) must not take the
  // key from lists, menus and pickers, so it only acts when nothing else holds focus -- which is
  // exactly the state a closed comment composer leaves behind.
  const hasCommandModifier = event.metaKey || event.ctrlKey || event.altKey
  if (!hasCommandModifier && !isNothingFocused(event.target)) {
    return false
  }
  if (mounted) {
    const target = mounted.getShortcutTarget()
    // Why focus first: the handlers read the editor's selection and position, and whatever the
    // user presses next should land in the editor they are reviewing.
    mounted.focus()
    if (redispatch(event, target)) {
      event.preventDefault()
      event.stopPropagation()
      return true
    }
    return false
  }
  // No diff editor open yet: file steps open the first (next) or last (previous) changed file.
  if (actionId === 'editor.nextFile' || actionId === 'editor.previousFile') {
    if (event.repeat) {
      return true
    }
    event.preventDefault()
    useAppStore.getState().stepToChangedFile(actionId === 'editor.nextFile' ? 'next' : 'previous')
    return true
  }
  return false
}
