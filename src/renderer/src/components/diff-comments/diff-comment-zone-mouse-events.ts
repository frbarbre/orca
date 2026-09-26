export function installDiffCommentZoneMouseDownStopper(target: EventTarget): () => void {
  const stopMouseDownPropagation = (ev: Event): void => ev.stopPropagation()
  target.addEventListener('mousedown', stopMouseDownPropagation)
  return () => target.removeEventListener('mousedown', stopMouseDownPropagation)
}

/**
 * Keeps a keystroke typed inside a zone card from reaching the editor underneath it.
 *
 * Why bubble and not capture: each card owns its own React root on this same node, so a
 * capture-phase stop here would fire before React's listener and swallow the card's own
 * shortcuts. In bubble the card has already handled the key, and the editor has not yet.
 */
export function installDiffCommentZoneKeyStopper(target: EventTarget): () => void {
  const stopKeyPropagation = (ev: Event): void => ev.stopPropagation()
  target.addEventListener('keydown', stopKeyPropagation)
  target.addEventListener('keyup', stopKeyPropagation)
  return () => {
    target.removeEventListener('keydown', stopKeyPropagation)
    target.removeEventListener('keyup', stopKeyPropagation)
  }
}
