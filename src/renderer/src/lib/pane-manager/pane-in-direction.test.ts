import { describe, expect, it } from 'vitest'
import { findPaneInDirection, type PaneBounds } from './pane-in-direction'

function pane(id: number, left: number, top: number, right: number, bottom: number): PaneBounds {
  return { id, left, top, right, bottom }
}

const GRID = [
  pane(1, 0, 0, 100, 100),
  pane(2, 102, 0, 200, 100),
  pane(3, 0, 102, 100, 200),
  pane(4, 102, 102, 200, 200),
  pane(5, 202, 0, 300, 200)
]

describe('findPaneInDirection', () => {
  it('moves to the neighbour on each side of a grid', () => {
    expect(findPaneInDirection(GRID, 1, 'right')).toBe(2)
    expect(findPaneInDirection(GRID, 1, 'down')).toBe(3)
    expect(findPaneInDirection(GRID, 4, 'up')).toBe(2)
    expect(findPaneInDirection(GRID, 4, 'left')).toBe(3)
    expect(findPaneInDirection(GRID, 4, 'right')).toBe(5)
  })

  it('stops at the edge instead of wrapping', () => {
    expect(findPaneInDirection(GRID, 1, 'left')).toBeNull()
    expect(findPaneInDirection(GRID, 1, 'up')).toBeNull()
    expect(findPaneInDirection(GRID, 5, 'right')).toBeNull()
  })

  it('skips a nearer pane that does not share the side', () => {
    const panes = [pane(1, 0, 0, 100, 100), pane(2, 102, 150, 200, 250), pane(3, 202, 0, 300, 100)]
    expect(findPaneInDirection(panes, 1, 'right')).toBe(3)
  })

  it('prefers the neighbour sharing more of the side', () => {
    const panes = [pane(1, 0, 0, 100, 200), pane(2, 102, 0, 200, 40), pane(3, 102, 42, 200, 200)]
    expect(findPaneInDirection(panes, 1, 'right')).toBe(3)
  })
})
