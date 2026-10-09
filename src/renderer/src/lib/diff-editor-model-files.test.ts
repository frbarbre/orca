import { describe, expect, it } from 'vitest'
import { isModifiedDiffSide, modelFileFor, trackDiffEditorFile } from './diff-editor-model-files'

function fakeEditor(uri: string) {
  let modelUri = uri
  const changeListeners: (() => void)[] = []
  const disposeListeners: (() => void)[] = []
  return {
    getModel: () => ({ uri: { toString: () => modelUri } }),
    onDidChangeModel: (listener: () => void) => {
      changeListeners.push(listener)
      return { dispose: () => {} }
    },
    onDidDispose: (listener: () => void) => {
      disposeListeners.push(listener)
      return { dispose: () => {} }
    },
    swapModel: (next: string) => {
      modelUri = next
      for (const listener of changeListeners) {
        listener()
      }
    },
    dispose: () => {
      for (const listener of disposeListeners) {
        listener()
      }
    }
  }
}

describe('diff editor model files', () => {
  it('knows the file behind both sides of a diff, follows model swaps and forgets on dispose', () => {
    const original = fakeEditor('diff:original:a')
    const modified = fakeEditor('diff:modified:a')
    const file = { worktreeId: 'wt-1', relativePath: 'apps/backend/a.py' }

    trackDiffEditorFile(
      { getOriginalEditor: () => original, getModifiedEditor: () => modified },
      file
    )
    expect(modelFileFor('diff:original:a')).toEqual(file)
    expect(modelFileFor('diff:modified:a')).toEqual(file)

    modified.swapModel('diff:modified:a#2')
    expect(modelFileFor('diff:modified:a#2')).toEqual(file)
    expect(modelFileFor('diff:modified:a')).toBeUndefined()

    modified.dispose()
    expect(modelFileFor('diff:modified:a#2')).toBeUndefined()
    expect(modelFileFor('diff:original:a')).toBeUndefined()
  })

  it('tells the current (modified) side from the old one, for blaming only the current text', () => {
    const original = fakeEditor('diff:original:b')
    const modified = fakeEditor('diff:modified:b')

    trackDiffEditorFile(
      { getOriginalEditor: () => original, getModifiedEditor: () => modified },
      { worktreeId: 'wt-1', relativePath: 'apps/backend/b.py' }
    )
    expect(isModifiedDiffSide('diff:modified:b')).toBe(true)
    expect(isModifiedDiffSide('diff:original:b')).toBe(false)

    modified.dispose()
    expect(isModifiedDiffSide('diff:modified:b')).toBe(false)
  })
})
