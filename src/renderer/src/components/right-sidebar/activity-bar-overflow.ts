import type { ActiveRightSidebarTab } from '@/store/slices/editor'

const TOP_ACTIVITY_BUTTON_WIDTH = 36
const TOP_ACTIVITY_COMPACT_BUTTON_WIDTH = 28
const TOP_ACTIVITY_MORE_BUTTON_WIDTH = 32
const HEADER_ACTION_LABELS_MIN_PANEL_WIDTH = 560

// Why the panel width, not the strip width: the strip widens when labels drop, which would flip it back.
export function showsHeaderActionLabels(panelWidth: number): boolean {
  return panelWidth >= HEADER_ACTION_LABELS_MIN_PANEL_WIDTH
}

export function getTopActivityBarLayout<T extends { id: ActiveRightSidebarTab }>(
  items: readonly T[],
  availableWidth: number | null,
  activeId: ActiveRightSidebarTab
): { visibleItems: T[]; overflowItems: T[]; compact: boolean } {
  if (!availableWidth || !Number.isFinite(availableWidth)) {
    return { visibleItems: [...items], overflowItems: [], compact: false }
  }
  if (items.length * TOP_ACTIVITY_BUTTON_WIDTH <= availableWidth) {
    return { visibleItems: [...items], overflowItems: [], compact: false }
  }
  // Fork: shrink the buttons before hiding any, so a narrow panel keeps every tab one click away.
  if (items.length * TOP_ACTIVITY_COMPACT_BUTTON_WIDTH <= availableWidth) {
    return { visibleItems: [...items], overflowItems: [], compact: true }
  }

  const visibleCount = Math.max(
    1,
    Math.min(
      items.length - 1,
      Math.floor(
        (availableWidth - TOP_ACTIVITY_MORE_BUTTON_WIDTH) / TOP_ACTIVITY_COMPACT_BUTTON_WIDTH
      )
    )
  )
  const visibleItems = items.slice(0, visibleCount)
  const activeItem = items.find((item) => item.id === activeId)
  if (activeItem && !visibleItems.some((item) => item.id === activeItem.id)) {
    visibleItems[visibleItems.length - 1] = activeItem
  }

  const visibleIds = new Set(visibleItems.map((item) => item.id))
  return {
    visibleItems,
    overflowItems: items.filter((item) => !visibleIds.has(item.id)),
    compact: true
  }
}
