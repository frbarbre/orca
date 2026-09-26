// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { isDiffShortcutTypingTarget } from './diff-shortcut-editable-target'

function firstChild(host: HTMLElement): HTMLElement {
  const child = host.firstElementChild
  if (!(child instanceof HTMLElement)) {
    throw new Error('fixture produced no element')
  }
  return child
}

function inZone(zoneClass: string, inner: string): HTMLElement {
  const zone = document.createElement('div')
  zone.className = zoneClass
  zone.innerHTML = inner
  return firstChild(zone)
}

function bare(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  return firstChild(host)
}

describe('isDiffShortcutTypingTarget', () => {
  it('stands aside for a review comment queued in a view zone', () => {
    expect(
      isDiffShortcutTypingTarget(inZone('orca-inline-pr-comment', '<textarea></textarea>'))
    ).toBe(true)
  })

  it('stands aside for a diff note in a view zone', () => {
    expect(
      isDiffShortcutTypingTarget(inZone('orca-diff-comment-inline', '<textarea></textarea>'))
    ).toBe(true)
  })

  // Why this case decides the shape of the guard: Monaco takes every keystroke through a
  // hidden textarea of its own, so a guard that only asked "is this editable" would disable
  // change navigation in exactly the place it is meant to work.
  it('keeps working for an editable outside our cards, which is how Monaco takes input', () => {
    expect(isDiffShortcutTypingTarget(bare('<textarea></textarea>'))).toBe(false)
    expect(isDiffShortcutTypingTarget(bare('<textarea class="ime-text-area"></textarea>'))).toBe(
      false
    )
  })

  it('ignores non-editable elements inside a card, and a missing target', () => {
    expect(isDiffShortcutTypingTarget(inZone('orca-inline-pr-comment', '<div>body</div>'))).toBe(
      false
    )
    expect(isDiffShortcutTypingTarget(null)).toBe(false)
  })
})
