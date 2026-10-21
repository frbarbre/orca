// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import HostedReviewActions from './HostedReviewActions'
import { useHostedReviewMergeControls } from './use-hosted-review-merge-controls'

const store = vi.hoisted(() => ({ gitStatusByWorktree: {} as Record<string, unknown[]> }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) =>
    select({ gitStatusByWorktree: store.gitStatusByWorktree, deleteStateByWorktreeId: {} })
}))
vi.mock('./use-hosted-review-actions', () => ({
  useHostedReviewActions: () => ({
    merging: false,
    readying: false,
    stateUpdating: null,
    actionError: null,
    handleMerge: vi.fn(),
    handleAutoMerge: vi.fn(),
    handleMarkReadyForReview: vi.fn(),
    handleCloseReview: vi.fn(),
    handleReopenReview: vi.fn()
  })
}))

afterEach(() => {
  cleanup()
  store.gitStatusByWorktree = {}
})

const openReview = {
  provider: 'github' as const,
  number: 42,
  state: 'open' as const,
  status: 'success' as const,
  mergeable: 'MERGEABLE' as const,
  mergeStateStatus: 'CLEAN',
  reviewDecision: 'APPROVED' as const
}
const repo = { id: 'repo-1', path: '/repo' } as Repo

describe('HostedReviewActions on an open PR', () => {
  it("leaves merging to Source Control's primary button, so the panel shows no merge button", () => {
    const { container } = render(
      <HostedReviewActions
        review={openReview}
        repo={repo}
        worktree={{ id: 'worktree-1' } as Worktree}
        onRefreshReview={vi.fn().mockResolvedValue(undefined)}
      />
    )

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('useHostedReviewMergeControls', () => {
  const controls = () =>
    renderHook(() =>
      useHostedReviewMergeControls({
        review: openReview,
        repo,
        worktreeId: 'worktree-1',
        onRefreshReview: vi.fn().mockResolvedValue(undefined)
      })
    ).result.current.primaryMerge

  it('merges a ready PR from a clean workspace', () => {
    expect(controls()).toMatchObject({ kind: 'merge', disabled: false })
  })

  it('refuses to merge while the workspace has uncommitted changes, and says why', () => {
    store.gitStatusByWorktree = { 'worktree-1': [{ path: 'a.ts' }, { path: 'b.ts' }] }

    expect(controls()).toMatchObject({
      disabled: true,
      tooltip: 'Commit your changes before merging (2 uncommitted)'
    })
  })
})
