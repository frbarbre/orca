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

import { installChangedFileNavigationShortcut } from './editor-shortcuts'
import {
  CHANGED_FILE_HOLD_STEP_INTERVAL_MS,
  endChangedFileHold
} from './changed-file-hold-navigation'

function dispatch(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  init: KeyboardEventInit
): KeyboardEvent {
  const event = new KeyboardEvent(type, { ...init, bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

const NEXT_FILE = { key: 'F7', code: 'F7', altKey: true }
const PREVIOUS_FILE = { key: 'F7', code: 'F7', altKey: true, shiftKey: true }

describe('installChangedFileNavigationShortcut', () => {
  let now = 0
  let container: HTMLDivElement
  let step: ReturnType<
    typeof vi.fn<(direction: 'next' | 'previous', options?: { wrap?: boolean }) => void>
  >
  let dispose: () => void

  beforeEach(() => {
    now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    container = document.createElement('div')
    document.body.appendChild(container)
    step = vi.fn()
    dispose = installChangedFileNavigationShortcut({ getContainerDomNode: () => container }, step)
  })

  afterEach(() => {
    dispose()
    endChangedFileHold()
    container.remove()
    shortcutState.keybindings = {}
    vi.restoreAllMocks()
  })

  it('steps once per press, wrapping as before', () => {
    const event = dispatch(container, 'keydown', NEXT_FILE)
    expect(event.defaultPrevented).toBe(true)
    expect(step).toHaveBeenCalledExactlyOnceWith('next')
  })

  it('keeps stepping while held, after the diff it started in is gone', () => {
    dispatch(container, 'keydown', PREVIOUS_FILE)
    // The first step opens another file, which remounts the diff and drops focus to the body.
    dispose()
    container.remove()

    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    const repeat = dispatch(document.body, 'keydown', { ...PREVIOUS_FILE, repeat: true })
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    dispatch(document.body, 'keydown', { ...PREVIOUS_FILE, repeat: true })

    expect(repeat.defaultPrevented).toBe(true)
    expect(step.mock.calls).toEqual([
      ['previous'],
      ['previous', { wrap: false }],
      ['previous', { wrap: false }]
    ])
  })

  it('drops repeats that arrive faster than the step interval', () => {
    dispatch(container, 'keydown', NEXT_FILE)
    now += 10
    const early = dispatch(document.body, 'keydown', { ...NEXT_FILE, repeat: true })
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    dispatch(document.body, 'keydown', { ...NEXT_FILE, repeat: true })

    // Consumed either way, so an early repeat cannot leak into Monaco.
    expect(early.defaultPrevented).toBe(true)
    expect(step).toHaveBeenCalledTimes(2)
  })

  it('stops on keyup', () => {
    dispatch(container, 'keydown', NEXT_FILE)
    dispatch(document.body, 'keyup', NEXT_FILE)
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    const repeat = dispatch(document.body, 'keydown', { ...NEXT_FILE, repeat: true })

    expect(repeat.defaultPrevented).toBe(false)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('stops when the chord no longer matches, e.g. the modifier is released', () => {
    dispatch(container, 'keydown', NEXT_FILE)
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    const bare = dispatch(document.body, 'keydown', { key: 'F7', code: 'F7', repeat: true })
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    const rematched = dispatch(document.body, 'keydown', { ...NEXT_FILE, repeat: true })

    expect(bare.defaultPrevented).toBe(false)
    expect(rematched.defaultPrevented).toBe(false)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('stops when the window loses focus', () => {
    dispatch(container, 'keydown', NEXT_FILE)
    window.dispatchEvent(new Event('blur'))
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    dispatch(document.body, 'keydown', { ...NEXT_FILE, repeat: true })

    expect(step).toHaveBeenCalledTimes(1)
  })

  it('honours a custom binding for the hold', () => {
    shortcutState.keybindings = { 'editor.nextFile': ['Shift+ArrowDown'] }
    const chord = { key: 'ArrowDown', code: 'ArrowDown', shiftKey: true }
    dispatch(container, 'keydown', chord)
    now += CHANGED_FILE_HOLD_STEP_INTERVAL_MS
    dispatch(document.body, 'keydown', { ...chord, repeat: true })

    expect(step.mock.calls).toEqual([['next'], ['next', { wrap: false }]])
  })
})
