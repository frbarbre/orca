function isOwnTrigger(target: Node, contentId: string): boolean {
  for (let node: Node | null = target; node; node = node.parentNode) {
    if (node instanceof Element && contentId && node.getAttribute('aria-controls') === contentId) {
      return true
    }
  }
  return false
}

/**
 * Fork: Radix closes a popover on the click that follows an outside press, and a press on a
 * scrollbar or one a drag overlay ends fires no click, so the popover stayed open. This closes it
 * when that click never comes.
 */
export function watchClicklessOutsidePress(args: {
  content: HTMLElement
  /** Reads and clears whether the press went through the popover's React tree, portals included. */
  consumePressInsideReactTree: () => boolean
  dismiss: () => void
}): () => void {
  const { content } = args
  const doc = content.ownerDocument
  let pending = false
  let timer: number | undefined

  // Why bubble: React's capture handlers on the content have run by then, so a press inside a
  // portaled child (a select in the popover) is known to be inside.
  const onPointerDown = (event: PointerEvent): void => {
    const inside = args.consumePressInsideReactTree()
    const target = event.target
    pending =
      event.button === 0 &&
      !inside &&
      target instanceof Node &&
      !content.contains(target) &&
      !isOwnTrigger(target, content.id)
  }
  const onClick = (): void => {
    pending = false
  }
  // Why a task after mouseup: the browser dispatches the click, when there is one, right after it.
  const onMouseUp = (): void => {
    if (!pending) {
      return
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (pending) {
        pending = false
        args.dismiss()
      }
    }, 0)
  }

  doc.addEventListener('pointerdown', onPointerDown)
  doc.addEventListener('click', onClick, true)
  doc.addEventListener('mouseup', onMouseUp, true)
  return () => {
    window.clearTimeout(timer)
    doc.removeEventListener('pointerdown', onPointerDown)
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('mouseup', onMouseUp, true)
  }
}
