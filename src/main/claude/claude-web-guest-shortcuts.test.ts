import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { ClaudeWebReplayedKey } from '../../shared/claude-remote-session'
import { installClaudeWebGuestShortcuts } from './claude-web-guest-shortcuts'

function install() {
  const emitter = new EventEmitter()
  const guest = {
    on: (
      name: 'before-input-event',
      listener: (event: { preventDefault(): void }, input: Electron.Input) => void
    ) => {
      emitter.on(name, listener)
    },
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    isDestroyed: () => false
  }
  const replayed: ClaudeWebReplayedKey[] = []
  installClaudeWebGuestShortcuts(
    guest,
    () => undefined,
    (key) => replayed.push(key),
    'darwin'
  )
  const send = (input: Partial<Electron.Input>): boolean => {
    const event = { preventDefault: vi.fn() }
    emitter.emit('before-input-event', event, {
      type: 'keyDown',
      key: '',
      code: '',
      meta: false,
      control: false,
      alt: false,
      shift: false,
      ...input
    })
    return event.preventDefault.mock.calls.length > 0
  }
  return { guest, send, replayed, listenerCount: () => emitter.listenerCount('before-input-event') }
}

describe('installClaudeWebGuestShortcuts', () => {
  it('reloads the page on Cmd+R and hard-reloads on Shift+Cmd+R', () => {
    const { guest, send, replayed } = install()

    expect(send({ key: 'r', code: 'KeyR', meta: true })).toBe(true)
    expect(guest.reload).toHaveBeenCalledOnce()
    expect(send({ key: 'R', code: 'KeyR', meta: true, shift: true })).toBe(true)
    expect(guest.reloadIgnoringCache).toHaveBeenCalledOnce()
    expect(replayed).toEqual([])
  })

  it('hands Orca app shortcuts to the renderer instead of the page', () => {
    const { send, replayed } = install()

    expect(send({ key: 'G', code: 'KeyG', meta: true, shift: true })).toBe(true)
    expect(send({ key: 'E', code: 'KeyE', meta: true, shift: true })).toBe(true)
    expect(send({ key: 't', code: 'KeyT', meta: true })).toBe(true)
    expect(replayed.map((key) => [key.type, key.code, key.metaKey, key.shiftKey])).toEqual([
      ['keydown', 'KeyG', true, true],
      ['keydown', 'KeyE', true, true],
      ['keydown', 'KeyT', true, false]
    ])
  })

  it('leaves copy, paste, undo and plain typing to the page', () => {
    const { send, replayed } = install()

    expect(send({ key: 'c', code: 'KeyC', meta: true })).toBe(false)
    expect(send({ key: 'v', code: 'KeyV', meta: true })).toBe(false)
    expect(send({ key: 'z', code: 'KeyZ', meta: true })).toBe(false)
    expect(send({ key: 'g', code: 'KeyG' })).toBe(false)
    expect(replayed).toEqual([])
  })

  it('follows a forwarded chord with its modifier releases, and only then', () => {
    const { send, replayed } = install()

    send({ type: 'keyUp', key: 'Meta', code: 'MetaLeft' })
    expect(replayed).toEqual([])

    send({ key: 'G', code: 'KeyG', meta: true, shift: true })
    send({ type: 'keyUp', key: 'Shift', code: 'ShiftLeft', meta: true })
    send({ type: 'keyUp', key: 'Meta', code: 'MetaLeft' })
    send({ type: 'keyUp', key: 'Meta', code: 'MetaLeft' })
    expect(replayed.map((key) => [key.type, key.key])).toEqual([
      ['keydown', 'G'],
      ['keyup', 'Shift'],
      ['keyup', 'Meta']
    ])
  })

  it('installs once per guest', () => {
    const { guest, listenerCount } = install()
    installClaudeWebGuestShortcuts(
      guest,
      () => undefined,
      () => {},
      'darwin'
    )
    expect(listenerCount()).toBe(1)
  })
})
