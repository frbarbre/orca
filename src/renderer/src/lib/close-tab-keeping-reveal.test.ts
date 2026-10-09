import { describe, expect, it } from 'vitest'
import { closeTabKeepingReveal } from './close-tab-keeping-reveal'

type Reveal = { filePath: string; line: number; column: number; matchLength: number }

function fakeStore(reveal: Reveal | null) {
  const state = {
    pendingEditorReveal: reveal,
    closed: [] as string[],
    closeFile: (fileId: string) => {
      state.closed.push(fileId)
      state.pendingEditorReveal = null
    },
    setPendingEditorReveal: (next: Reveal | null) => {
      state.pendingEditorReveal = next
    }
  }
  return state
}

describe('closeTabKeepingReveal', () => {
  it("closes the replaced tab without dropping the jump target's pending line", () => {
    const toScope = { filePath: '/repo/scope.py', line: 206, column: 1, matchLength: 0 }
    const store = fakeStore(toScope)

    closeTabKeepingReveal(store, 'diff:/repo/_parameters.py')
    expect(store.closed).toEqual(['diff:/repo/_parameters.py'])
    expect(store.pendingEditorReveal).toEqual(toScope)
  })

  it('leaves no reveal when none was pending', () => {
    const store = fakeStore(null)

    closeTabKeepingReveal(store, '/repo/a.py')
    expect(store.pendingEditorReveal).toBeNull()
  })
})
