import { describe, expect, it } from 'vitest'
import { shelfResizeTarget } from './shelf-sizing'

describe('shelfResizeTarget', () => {
  it('opens a shelf to the height the user chose when its list expands', () => {
    expect(shelfResizeTarget({ size: 30, natural: 900, previousNatural: 30, preferred: 300 })).toBe(
      300
    )
    expect(shelfResizeTarget({ size: 30, natural: 120, previousNatural: 30, preferred: 300 })).toBe(
      120
    )
  })

  it('fits a shelf to its content when the content shrinks below it', () => {
    expect(
      shelfResizeTarget({ size: 300, natural: 30, previousNatural: 900, preferred: 300 })
    ).toBe(30)
  })

  it('leaves a shelf the user made smaller than its content alone as the content grows', () => {
    expect(
      shelfResizeTarget({ size: 200, natural: 1000, previousNatural: 900, preferred: 300 })
    ).toBeNull()
  })

  it('sizes a shelf on its first measurement', () => {
    expect(shelfResizeTarget({ size: 300, natural: 80, previousNatural: 0, preferred: 300 })).toBe(
      80
    )
  })
})
