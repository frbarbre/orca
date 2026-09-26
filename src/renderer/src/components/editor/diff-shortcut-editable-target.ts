import { isEditableTarget } from '@/lib/editable-target'

/**
 * Selectors for the cards Orca renders into Monaco view zones — a queued review comment,
 * a posted review thread, a diff note.
 */
const ZONE_CARD_SELECTOR = '.orca-inline-pr-comment, .orca-diff-comment-inline'

/**
 * Whether a diff shortcut must stand aside because the user is typing in one of our cards.
 *
 * Why this asks where the field is rather than which field it is: Monaco takes keyboard input
 * through its own hidden textarea inside the editor, so "is this editable" is true exactly when
 * the diff is focused, and guarding on that alone disables change navigation where it belongs.
 * Excluding Monaco's input by class would work until Monaco renames it, and the class differs
 * between builds. Our own zone cards are the thing we control, so they are what we look for.
 */
export function isDiffShortcutTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return isEditableTarget(target) && target.closest(ZONE_CARD_SELECTOR) !== null
}
