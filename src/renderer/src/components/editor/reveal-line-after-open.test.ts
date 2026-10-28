import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealLineAfterOpen } from './reveal-line-after-open'

const store = vi.hoisted(() => ({ setPendingEditorReveal: vi.fn() }))

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))

const frames: FrameRequestCallback[] = []
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))

function runFrame(): void {
  frames.splice(0).forEach((callback) => callback(0))
}

afterEach(() => {
  frames.length = 0
  store.setPendingEditorReveal.mockReset()
})

describe('revealLineAfterOpen', () => {
  it('clears a stale reveal, then asks for the line once the opened editor has mounted', () => {
    revealLineAfterOpen('/repo/src/a.ts', 42)
    expect(store.setPendingEditorReveal.mock.calls).toEqual([[null]])

    runFrame()
    expect(store.setPendingEditorReveal).toHaveBeenCalledTimes(1)
    runFrame()

    expect(store.setPendingEditorReveal).toHaveBeenLastCalledWith({
      filePath: '/repo/src/a.ts',
      line: 42,
      column: 1,
      matchLength: 0
    })
  })
})
