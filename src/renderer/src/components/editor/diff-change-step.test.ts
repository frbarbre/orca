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

function createEditor(changes: editor.ILineChange[] | null, line: number, lineCount = 100) {
  const goToDiff = vi.fn()
  const diffEditor = {
    getLineChanges: () => changes,
    getModifiedEditor: () => ({
      getPosition: () => ({ lineNumber: line }),
      getModel: () => ({ getLineCount: () => lineCount })
    }),
    goToDiff
  } as unknown as editor.IStandaloneDiffEditor
  return { diffEditor, goToDiff }
}

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
