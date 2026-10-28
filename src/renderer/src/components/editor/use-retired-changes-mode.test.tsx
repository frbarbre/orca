// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  setEditorViewMode: vi.fn(),
  showFileDiff: vi.fn(async () => true)
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ setEditorViewMode: fixture.setEditorViewMode }) }
}))
vi.mock('./file-tab-view-switch', () => ({ showFileDiff: fixture.showFileDiff }))

import { useRetiredChangesMode } from './use-retired-changes-mode'

describe('useRetiredChangesMode', () => {
  it("turns a tab's old in-place Changes view into the file's diff tab", () => {
    renderHook(() => useRetiredChangesMode('/repo/src/a.ts'))

    expect(fixture.setEditorViewMode).toHaveBeenCalledWith('/repo/src/a.ts', 'edit')
    expect(fixture.showFileDiff).toHaveBeenCalledWith('/repo/src/a.ts')
  })

  it('does nothing for a tab showing its editor', () => {
    fixture.showFileDiff.mockClear()
    renderHook(() => useRetiredChangesMode(null))

    expect(fixture.showFileDiff).not.toHaveBeenCalled()
  })
})
