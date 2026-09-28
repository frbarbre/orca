import type { PaneFocusDirection } from '../../../../shared/keybindings/directional-pane-focus'

export type PaneBounds = {
  id: number
  left: number
  top: number
  right: number
  bottom: number
}

// Why: split dividers leave a few pixels between neighbours, and rects are fractional.
const EDGE_TOLERANCE_PX = 2

function overlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB))
}

export function findPaneInDirection(
  panes: readonly PaneBounds[],
  activeId: number,
  direction: PaneFocusDirection
): number | null {
  const active = panes.find((pane) => pane.id === activeId)
  if (!active) {
    return null
  }
  const horizontal = direction === 'left' || direction === 'right'
  let best: { id: number; gap: number; shared: number } | null = null
  for (const pane of panes) {
    if (pane.id === activeId) {
      continue
    }
    const gap =
      direction === 'left'
        ? active.left - pane.right
        : direction === 'right'
          ? pane.left - active.right
          : direction === 'up'
            ? active.top - pane.bottom
            : pane.top - active.bottom
    if (gap < -EDGE_TOLERANCE_PX) {
      continue
    }
    const shared = horizontal
      ? overlap(active.top, active.bottom, pane.top, pane.bottom)
      : overlap(active.left, active.right, pane.left, pane.right)
    if (shared <= 0) {
      continue
    }
    if (
      !best ||
      gap < best.gap - EDGE_TOLERANCE_PX ||
      (Math.abs(gap - best.gap) <= EDGE_TOLERANCE_PX && shared > best.shared)
    ) {
      best = { id: pane.id, gap, shared }
    }
  }
  return best?.id ?? null
}
