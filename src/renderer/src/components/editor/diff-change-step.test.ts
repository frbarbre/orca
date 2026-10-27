import { describe, expect, it, vi } from 'vitest'
import type { editor } from 'monaco-editor'
import { goToDiffWithoutWrap, hasChangeInDirection } from './diff-change-step'

function change(start: number, end: number): editor.ILineChange {
  return {
    originalStartLineNumber: start,
    originalEndLineNumber: end,
    modifiedStartLineNumber: start,
    modifiedEndLineNumber: end,
    charChanges: undefined
  }
}

const LINE_HEIGHT = 20
const VIEWPORT_HEIGHT = 200

function createEditor(
  changes: editor.ILineChange[] | null,
  line: number,
  lineCount = 100,
  scrollTop = (line - 1) * LINE_HEIGHT
) {
  const goToDiff = vi.fn()
  const setScrollTop = vi.fn()
  const modified = {
    getPosition: () => ({ lineNumber: line }),
    getModel: () => ({ getLineCount: () => lineCount }),
    getScrollTop: () => scrollTop,
    setScrollTop,
    getLayoutInfo: () => ({ height: VIEWPORT_HEIGHT }),
    getTopForLineNumber: (lineNumber: number) => (lineNumber - 1) * LINE_HEIGHT,
    getBottomForLineNumber: (lineNumber: number) => lineNumber * LINE_HEIGHT
  }
  const diffEditor = {
    getLineChanges: () => changes,
    getModifiedEditor: () => modified,
    goToDiff
  } as unknown as editor.IStandaloneDiffEditor
  return { diffEditor, goToDiff, setScrollTop }
}

describe('stepping through a change taller than the viewport', () => {
  // Lines 10-60 span 180px-1200px; the viewport shows 200px.
  const long = change(10, 60)

  it('scrolls down within the change while its end is below the viewport', () => {
    const { diffEditor, goToDiff, setScrollTop } = createEditor([long, change(80, 81)], 10)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(goToDiff).not.toHaveBeenCalled()
    const [scrollTop] = setScrollTop.mock.calls[0]
    // Advances, but keeps part of what was on screen so the reader doesn't lose their place.
    expect(scrollTop).toBeGreaterThan(180)
    expect(scrollTop).toBeLessThan(180 + VIEWPORT_HEIGHT)
  })

  it("stops scrolling at the change's end rather than past it", () => {
    const { diffEditor, setScrollTop } = createEditor([long, change(80, 81)], 10, 100, 950)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(setScrollTop).toHaveBeenCalledWith(1200 - VIEWPORT_HEIGHT)
  })

  it('jumps to the next change once the end of the current one is visible', () => {
    const { diffEditor, goToDiff, setScrollTop } = createEditor(
      [long, change(80, 81)],
      10,
      100,
      1200 - VIEWPORT_HEIGHT
    )
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(setScrollTop).not.toHaveBeenCalled()
    expect(goToDiff).toHaveBeenCalledWith('next')
  })

  it('scrolls through the last change even though there is no change after it', () => {
    const { diffEditor, setScrollTop } = createEditor([long], 10)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(setScrollTop).toHaveBeenCalled()
  })

  it('scrolls up within the change while its start is above the viewport', () => {
    const { diffEditor, goToDiff, setScrollTop } = createEditor([change(1, 2), long], 10, 100, 600)
    goToDiffWithoutWrap(diffEditor, 'previous')
    expect(goToDiff).not.toHaveBeenCalled()
    const [scrollTop] = setScrollTop.mock.calls[0]
    expect(scrollTop).toBeLessThan(600)
    expect(scrollTop).toBeGreaterThan(600 - VIEWPORT_HEIGHT)
  })

  it("stops scrolling up at the change's start, then jumps to the previous change", () => {
    const near = createEditor([change(1, 2), long], 10, 100, 250)
    goToDiffWithoutWrap(near.diffEditor, 'previous')
    expect(near.setScrollTop).toHaveBeenCalledWith(180)

    const atTop = createEditor([change(1, 2), long], 10, 100, 180)
    goToDiffWithoutWrap(atTop.diffEditor, 'previous')
    expect(atTop.setScrollTop).not.toHaveBeenCalled()
    expect(atTop.goToDiff).toHaveBeenCalledWith('previous')
  })

  it('jumps as usual when the cursor is not in the tall change', () => {
    const { diffEditor, goToDiff, setScrollTop } = createEditor([change(5, 6), long], 5, 100, 180)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(setScrollTop).not.toHaveBeenCalled()
    expect(goToDiff).toHaveBeenCalledWith('next')
  })

  it('treats a tall deleted block, drawn after its anchor line, the same way', () => {
    const deletion = { ...change(20, 0), modifiedStartLineNumber: 20, modifiedEndLineNumber: 0 }
    const diffEditor = createEditor([deletion], 21, 100, 300)
    const modified = diffEditor.diffEditor.getModifiedEditor()
    // A 500px zone of deleted lines sits between lines 20 and 21.
    Object.assign(modified, {
      getTopForLineNumber: (lineNumber: number, includeViewZones?: boolean) =>
        (lineNumber - 1) * LINE_HEIGHT + (lineNumber > 20 && !includeViewZones ? 500 : 0),
      getBottomForLineNumber: (lineNumber: number) =>
        lineNumber * LINE_HEIGHT + (lineNumber > 20 ? 500 : 0)
    })
    goToDiffWithoutWrap(diffEditor.diffEditor, 'next')
    expect(diffEditor.goToDiff).not.toHaveBeenCalled()
    expect(diffEditor.setScrollTop).toHaveBeenCalled()
  })
})

describe('goToDiffWithoutWrap', () => {
  const changes = [change(10, 12), change(40, 41)]

  it('steps between changes', () => {
    const { diffEditor, goToDiff } = createEditor(changes, 10)
    goToDiffWithoutWrap(diffEditor, 'next')
    goToDiffWithoutWrap(diffEditor, 'previous')
    expect(goToDiff).toHaveBeenCalledTimes(1)
    expect(goToDiff).toHaveBeenCalledWith('next')
  })

  it('does nothing past the last change instead of wrapping to the first', () => {
    const { diffEditor, goToDiff } = createEditor(changes, 40)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(goToDiff).not.toHaveBeenCalled()
    goToDiffWithoutWrap(diffEditor, 'previous')
    expect(goToDiff).toHaveBeenCalledWith('previous')
  })

  it('does nothing before the first change instead of wrapping to the last', () => {
    const { diffEditor, goToDiff } = createEditor(changes, 10)
    goToDiffWithoutWrap(diffEditor, 'previous')
    expect(goToDiff).not.toHaveBeenCalled()
  })

  it('treats the line after a pure deletion as where the deletion starts', () => {
    // A deletion after line 20 is reported as start 20, end 0; goToDiff lands on line 21.
    const deletion = { ...change(20, 0), modifiedStartLineNumber: 20, modifiedEndLineNumber: 0 }
    expect(hasChangeInDirection(createEditor([deletion], 20).diffEditor, 'next')).toBe(true)
    expect(hasChangeInDirection(createEditor([deletion], 21).diffEditor, 'next')).toBe(false)
    expect(hasChangeInDirection(createEditor([deletion], 21).diffEditor, 'previous')).toBe(false)
  })

  it('never steps forward from the last line, where Monaco would wrap', () => {
    const { diffEditor, goToDiff } = createEditor([change(5, 5)], 100, 100)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(goToDiff).not.toHaveBeenCalled()
  })

  it('does nothing while the diff has not been computed', () => {
    const { diffEditor, goToDiff } = createEditor(null, 1)
    goToDiffWithoutWrap(diffEditor, 'next')
    expect(goToDiff).not.toHaveBeenCalled()
  })
})
