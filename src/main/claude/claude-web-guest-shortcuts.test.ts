import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { installClaudeWebGuestShortcuts } from './claude-web-guest-shortcuts'

function fakeGuest() {
  const emitter = new EventEmitter()
  const guest = {
    on: (name: string, listener: (...args: unknown[]) => void) => {
      emitter.on(name, listener)
      return guest
    },
    reload: vi.fn(),
    reloadIgnoringCache: vi.fn(),
    isDestroyed: () => false
  }
  const press = (input: Partial<Electron.Input>): boolean => {
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
  return { guest, press, listenerCount: () => emitter.listenerCount('before-input-event') }
}

describe('installClaudeWebGuestShortcuts', () => {
  it('reloads the page on Cmd+R and hard-reloads on Shift+Cmd+R', () => {
    const { guest, press } = fakeGuest()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every member the installer touches.
    installClaudeWebGuestShortcuts(guest as never, () => undefined, 'darwin')

    expect(press({ key: 'r', code: 'KeyR', meta: true })).toBe(true)
    expect(guest.reload).toHaveBeenCalledTimes(1)

    expect(press({ key: 'R', code: 'KeyR', meta: true, shift: true })).toBe(true)
    expect(guest.reloadIgnoringCache).toHaveBeenCalledTimes(1)
  })

  it('leaves copy, paste and plain typing to the page', () => {
    const { guest, press } = fakeGuest()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every member the installer touches.
    installClaudeWebGuestShortcuts(guest as never, () => undefined, 'darwin')

    expect(press({ key: 'c', code: 'KeyC', meta: true })).toBe(false)
    expect(press({ key: 'v', code: 'KeyV', meta: true })).toBe(false)
    expect(press({ key: 'r', code: 'KeyR' })).toBe(false)
    expect(guest.reload).not.toHaveBeenCalled()
  })

  it('installs once per guest', () => {
    const { guest, listenerCount } = fakeGuest()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every member the installer touches.
    installClaudeWebGuestShortcuts(guest as never, () => undefined, 'darwin')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake implements every member the installer touches.
    installClaudeWebGuestShortcuts(guest as never, () => undefined, 'darwin')
    expect(listenerCount()).toBe(1)
  })
})
