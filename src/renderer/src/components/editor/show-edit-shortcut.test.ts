// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const shortcutState = vi.hoisted(() => ({
  keybindings: {} as Record<string, string[]>,
  platform: 'darwin' as NodeJS.Platform
}))

vi.mock('@/lib/shortcut-platform', () => ({
  getShortcutPlatform: () => shortcutState.platform
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ keybindings: shortcutState.keybindings })
  }
}))

import { installShowEditShortcut } from './editor-shortcuts'

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

// Why ´: macOS types a dead key for Option+E, so the chord is matched by its physical key.
const MOD_ALT_E = { key: '´', code: 'KeyE', metaKey: true, altKey: true }

describe('installShowEditShortcut', () => {
  let container: HTMLDivElement
  let show: ReturnType<typeof vi.fn<() => void>>
  let dispose: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    show = vi.fn()
    dispose = installShowEditShortcut({ getContainerDomNode: () => container }, show)
  })

  afterEach(() => {
    dispose()
    container.remove()
    shortcutState.keybindings = {}
  })

  it('switches to the editor once per Mod+Alt+E press and keeps the key from Monaco', () => {
    const first = press(container, MOD_ALT_E)
    press(container, { ...MOD_ALT_E, repeat: true })

    expect(show).toHaveBeenCalledOnce()
    expect(first.defaultPrevented).toBe(true)
  })

  it('no longer answers to F4', () => {
    press(container, { key: 'F4', code: 'F4' })

    expect(show).not.toHaveBeenCalled()
  })

  it('follows a rebinding from Settings', () => {
    shortcutState.keybindings = { 'editor.showEdit': ['Mod+Shift+O'] }

    press(container, MOD_ALT_E)
    press(container, { key: 'o', code: 'KeyO', metaKey: true, shiftKey: true })

    expect(show).toHaveBeenCalledOnce()
  })

  it('leaves the key alone while typing in a review comment', () => {
    const card = document.createElement('div')
    card.className = 'orca-diff-comment-inline'
    const textarea = document.createElement('textarea')
    card.appendChild(textarea)
    container.appendChild(card)

    const event = press(textarea, MOD_ALT_E)

    expect(show).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('stops listening once removed', () => {
    dispose()
    press(container, MOD_ALT_E)
    dispose = () => undefined

    expect(show).not.toHaveBeenCalled()
  })
})
