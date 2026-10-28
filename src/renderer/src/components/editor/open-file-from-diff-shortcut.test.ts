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

import { installOpenFileFromDiffShortcut } from './editor-shortcuts'

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

const F4 = { key: 'F4', code: 'F4' }

describe('installOpenFileFromDiffShortcut', () => {
  let container: HTMLDivElement
  let open: ReturnType<typeof vi.fn<() => void>>
  let dispose: () => void

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    open = vi.fn()
    dispose = installOpenFileFromDiffShortcut({ getContainerDomNode: () => container }, open)
  })

  afterEach(() => {
    dispose()
    container.remove()
    shortcutState.keybindings = {}
  })

  it('opens the file tab once per F4 press and keeps the key from Monaco', () => {
    const first = press(container, F4)
    press(container, { ...F4, repeat: true })

    expect(open).toHaveBeenCalledOnce()
    expect(first.defaultPrevented).toBe(true)
  })

  it('follows a rebinding from Settings', () => {
    shortcutState.keybindings = { 'editor.openFileFromDiff': ['Mod+Shift+O'] }

    press(container, F4)
    press(container, { key: 'o', code: 'KeyO', metaKey: true, shiftKey: true })

    expect(open).toHaveBeenCalledOnce()
  })

  it('leaves the key alone while typing in a review comment', () => {
    const card = document.createElement('div')
    card.className = 'orca-diff-comment-inline'
    const textarea = document.createElement('textarea')
    card.appendChild(textarea)
    container.appendChild(card)

    const event = press(textarea, F4)

    expect(open).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('stops listening once removed', () => {
    dispose()
    press(container, F4)
    dispose = () => undefined

    expect(open).not.toHaveBeenCalled()
  })
})
