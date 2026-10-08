const WINDOW_EDGE_GAP_PX = 8

// Fork: a list opened at the caret near the right edge ran off the window.
export function clampListLeft(left: number, width: number): number {
  return Math.max(
    WINDOW_EDGE_GAP_PX,
    Math.min(left, window.innerWidth - width - WINDOW_EDGE_GAP_PX)
  )
}
