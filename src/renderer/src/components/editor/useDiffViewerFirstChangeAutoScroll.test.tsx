// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { editor } from 'monaco-editor'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiffViewerFirstChangeAutoScroll } from './useDiffViewerFirstChangeAutoScroll'

const FIRST_CHANGE_LINE = 24

function fakeEditors() {
  const modified = {
    getModel: () => ({}),
    getLayoutInfo: () => ({ height: 600 }),
    getTopForLineNumber: (line: number) => line * 20,
    setPosition: vi.fn(),
    setScrollTop: vi.fn(),
    onDidLayoutChange: () => ({ dispose: () => {} })
  }
  const diff = {
    getLineChanges: () => [{ modifiedStartLineNumber: FIRST_CHANGE_LINE }],
    onDidUpdateDiff: () => ({ dispose: () => {} })
  }
  return {
    modified: modified as unknown as editor.ICodeEditor & typeof modified,
    diffRef: { current: diff as unknown as editor.IStandaloneDiffEditor }
  }
}

function Probe(props: Parameters<typeof useDiffViewerFirstChangeAutoScroll>[0]): null {
  useDiffViewerFirstChangeAutoScroll(props)
  return null
}

describe('useDiffViewerFirstChangeAutoScroll', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.unstubAllGlobals()
  })

  it('centres a newly opened diff on its first change', () => {
    const { modified, diffRef } = fakeEditors()
    const props = { diffEditorRef: diffRef, modelKey: 'scope.py', pendingScrollCommentId: null }
    act(() => root.render(<Probe {...props} modifiedEditor={modified} />))

    expect(modified.setPosition).toHaveBeenCalledWith({ lineNumber: FIRST_CHANGE_LINE, column: 1 })
  })

  it('leaves a diff opened for a go-to-definition jump where the jump put it', () => {
    const { modified, diffRef } = fakeEditors()
    const props = { diffEditorRef: diffRef, modelKey: 'scope.py', pendingScrollCommentId: null }
    act(() => root.render(<Probe {...props} modifiedEditor={null} hasPendingReveal />))
    // Why: the reveal to line 206 is applied and cleared before the editor reaches this hook.
    act(() => root.render(<Probe {...props} modifiedEditor={modified} hasPendingReveal={false} />))

    expect(modified.setPosition).not.toHaveBeenCalled()
    expect(modified.setScrollTop).not.toHaveBeenCalled()
  })
})
