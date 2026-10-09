import { describe, expect, it } from 'vitest'
import type { ActiveRightSidebarTab } from '@/store/slices/editor'
import { getTopActivityBarLayout, showsHeaderActionLabels } from './activity-bar-overflow'

const items = (['explorer', 'source-control', 'checks', 'ports'] as ActiveRightSidebarTab[]).map(
  (id) => ({ id })
)

describe('getTopActivityBarLayout', () => {
  it('shows every item when the top activity strip has enough room', () => {
    const layout = getTopActivityBarLayout(items, 144, 'explorer')

    expect(layout.visibleItems.map((item) => item.id)).toEqual([
      'explorer',
      'source-control',
      'checks',
      'ports'
    ])
    expect(layout.overflowItems).toEqual([])
    expect(layout.compact).toBe(false)
  })

  it('packs the buttons tighter before hiding any of them', () => {
    const layout = getTopActivityBarLayout(items, 124, 'explorer')

    expect(layout.visibleItems).toHaveLength(4)
    expect(layout.overflowItems).toEqual([])
    expect(layout.compact).toBe(true)
  })

  it('moves trailing items behind the overflow menu when even packed buttons do not fit', () => {
    const layout = getTopActivityBarLayout(items, 100, 'explorer')

    expect(layout.visibleItems.map((item) => item.id)).toEqual(['explorer', 'source-control'])
    expect(layout.overflowItems.map((item) => item.id)).toEqual(['checks', 'ports'])
    expect(layout.compact).toBe(true)
  })

  it('drops the header action labels in a narrow panel so the tabs keep their room', () => {
    expect(showsHeaderActionLabels(640)).toBe(true)
    expect(showsHeaderActionLabels(480)).toBe(false)
  })

  it('keeps the active tab visible even when it would otherwise overflow', () => {
    const layout = getTopActivityBarLayout(items, 100, 'ports')

    expect(layout.visibleItems.map((item) => item.id)).toEqual(['explorer', 'ports'])
    expect(layout.overflowItems.map((item) => item.id)).toEqual(['source-control', 'checks'])
  })
})
