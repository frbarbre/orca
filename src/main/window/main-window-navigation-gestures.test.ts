import { describe, expect, it } from 'vitest'
import {
  historyDirectionForAppCommand,
  historyDirectionForSwipe
} from './main-window-navigation-gestures'

describe('main window navigation gestures', () => {
  it("turns a mouse's back/forward swipe into a history step", () => {
    expect(historyDirectionForSwipe('left')).toBe('back')
    expect(historyDirectionForSwipe('right')).toBe('forward')
    expect(historyDirectionForSwipe('up')).toBeNull()
  })

  it("turns the Windows/Linux mouse's back/forward command into a history step", () => {
    expect(historyDirectionForAppCommand('browser-backward')).toBe('back')
    expect(historyDirectionForAppCommand('browser-forward')).toBe('forward')
    expect(historyDirectionForAppCommand('media-play')).toBeNull()
  })
})
