import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceIndexShortcutHintStore } from './workspace-index-shortcut-hint'

type Keys = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

function key(init: Keys): KeyboardEvent {
  return {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...init
  } as KeyboardEvent
}

const targets = Array.from({ length: 11 }, (_, index) => `wt-${index + 1}`)

function createStore(
  options: { bindings?: string[]; platform?: NodeJS.Platform; enabled?: boolean } = {}
) {
  return createWorkspaceIndexShortcutHintStore({
    getBindings: () => options.bindings ?? ['Mod+1'],
    getPlatform: () => options.platform ?? 'darwin',
    getTargetIds: () => targets,
    isEnabled: () => options.enabled ?? true
  })
}

describe('workspace index shortcut hint', () => {
  it('shows the digit shortcut on the first nine workspaces the moment Mod is pressed', () => {
    const store = createStore()
    store.keyDown(key({ key: 'Meta', metaKey: true }))

    expect(store.getKeys('wt-1')).toEqual(['⌘', '1'])
    expect(store.getKeys('wt-9')).toEqual(['⌘', '9'])
    expect(store.getKeys('wt-10')).toBeNull()
  })

  it('renders Ctrl on Windows and Linux', () => {
    const store = createStore({ platform: 'linux' })
    store.keyDown(key({ key: 'Control', ctrlKey: true }))

    expect(store.getKeys('wt-2')).toEqual(['Ctrl', '2'])
  })

  it('follows a remapped binding', () => {
    const store = createStore({ bindings: ['Alt+Shift+1'] })
    store.keyDown(key({ key: 'Alt', altKey: true }))
    expect(store.getKeys('wt-1')).toBeNull()

    store.keyDown(key({ key: 'Shift', altKey: true, shiftKey: true }))
    expect(store.getKeys('wt-3')).toEqual(['⌥', '⇧', '3'])
  })

  it('ignores other modifier combinations', () => {
    const store = createStore()
    store.keyDown(key({ key: 'Shift', metaKey: true, shiftKey: true }))

    expect(store.getKeys('wt-1')).toBeNull()
  })

  it('hides when Mod is used for another shortcut, until it is released', () => {
    const store = createStore()
    store.keyDown(key({ key: 'Meta', metaKey: true }))
    store.keyDown(key({ key: 'c', metaKey: true }))
    expect(store.getKeys('wt-1')).toBeNull()

    store.keyDown(key({ key: 'Meta', metaKey: true }))
    expect(store.getKeys('wt-1')).toBeNull()

    store.keyUp(key({ key: 'Meta' }))
    store.keyDown(key({ key: 'Meta', metaKey: true }))
    expect(store.getKeys('wt-1')).toEqual(['⌘', '1'])
  })

  it('hides on release and on clear', () => {
    const store = createStore()
    store.keyDown(key({ key: 'Meta', metaKey: true }))
    store.keyUp(key({ key: 'Meta' }))
    expect(store.getKeys('wt-1')).toBeNull()

    store.keyDown(key({ key: 'Meta', metaKey: true }))
    store.clear()
    expect(store.getKeys('wt-1')).toBeNull()
  })

  it('notifies subscribers when the hint appears and disappears', () => {
    const store = createStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.keyDown(key({ key: 'Meta', metaKey: true }))
    store.keyUp(key({ key: 'Meta' }))

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('stays hidden where the shortcut does nothing or is unbound', () => {
    const disabled = createStore({ enabled: false })
    disabled.keyDown(key({ key: 'Meta', metaKey: true }))
    const unbound = createStore({ bindings: [] })
    unbound.keyDown(key({ key: 'Meta', metaKey: true }))

    expect(disabled.getKeys('wt-1')).toBeNull()
    expect(unbound.getKeys('wt-1')).toBeNull()
  })
})
