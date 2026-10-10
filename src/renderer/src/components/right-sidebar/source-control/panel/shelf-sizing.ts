const SIZE_TOLERANCE_PX = 1

// Why only on content changes: a shelf the user dragged smaller than its list must keep that
// height, while one that showed its whole list follows it open (expand) and closed (collapse).
export function shelfResizeTarget({
  size,
  natural,
  previousNatural,
  preferred
}: {
  size: number
  natural: number
  previousNatural: number
  preferred: number
}): number | null {
  if (natural < size - SIZE_TOLERANCE_PX) {
    return natural
  }
  if (
    natural > previousNatural + SIZE_TOLERANCE_PX &&
    size >= previousNatural - SIZE_TOLERANCE_PX
  ) {
    return Math.min(natural, preferred)
  }
  return null
}
