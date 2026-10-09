// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSourceControlPanelViewState } from './use-panel-view-state'

describe('hidden file types per worktree', () => {
  it('keeps what one worktree hides out of the others, and remembers it on return', () => {
    const { result, rerender } = renderHook(
      ({ worktreeId }) =>
        useSourceControlPanelViewState({
          activeWorktreeId: worktreeId,
          settings: null,
          updateSettings: vi.fn()
        }),
      { initialProps: { worktreeId: 'wt-a' } }
    )

    act(() => result.current.toggleFileCategory('test'))
    expect([...result.current.hiddenFileCategories]).toEqual(['test'])

    rerender({ worktreeId: 'wt-b' })
    expect([...result.current.hiddenFileCategories]).toEqual([])

    rerender({ worktreeId: 'wt-a' })
    expect([...result.current.hiddenFileCategories]).toEqual(['test'])
  })
})
