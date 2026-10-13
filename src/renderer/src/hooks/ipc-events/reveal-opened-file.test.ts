import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  activeFileIdByWorktree: { wt: 'file-1' } as Record<string, string>,
  setPendingEditorReveal: vi.fn(),
  setMarkdownViewMode: vi.fn()
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => store } }))

import { revealOpenedFile } from './reveal-opened-file'

describe('revealOpenedFile', () => {
  beforeEach(() => {
    store.setPendingEditorReveal.mockReset()
    store.setMarkdownViewMode.mockReset()
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      queueMicrotask(callback)
      return 1
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('puts the cursor on the line once the tab has mounted', async () => {
    revealOpenedFile('wt', '/w/src/App.tsx', 'typescript', { line: 42, column: 7 })
    // Only the stale reveal is cleared up front; the line itself waits for the tab to mount.
    expect(store.setPendingEditorReveal.mock.calls).toEqual([[null]])

    await vi.waitFor(() =>
      expect(store.setPendingEditorReveal).toHaveBeenCalledWith({
        filePath: '/w/src/App.tsx',
        fileId: 'file-1',
        line: 42,
        column: 7,
        matchLength: 0
      })
    )
  })

  it('starts at the first column when none is given', async () => {
    revealOpenedFile('wt', '/w/src/App.tsx', 'typescript', { line: 3 })

    await vi.waitFor(() =>
      expect(store.setPendingEditorReveal).toHaveBeenCalledWith(
        expect.objectContaining({ line: 3, column: 1 })
      )
    )
  })

  it('shows Markdown as source, which is where a line can be revealed', () => {
    revealOpenedFile('wt', '/w/README.md', 'markdown', { line: 3 })

    expect(store.setMarkdownViewMode).toHaveBeenCalledWith('file-1', 'source')
  })
})
