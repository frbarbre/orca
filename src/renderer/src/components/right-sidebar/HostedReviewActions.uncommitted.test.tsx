// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import HostedReviewActions from './HostedReviewActions'

const store = vi.hoisted(() => ({ gitStatusByWorktree: {} as Record<string, unknown[]> }))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) =>
    select({ gitStatusByWorktree: store.gitStatusByWorktree, deleteStateByWorktreeId: {} })
}))
const handleMerge = vi.hoisted(() => vi.fn())
vi.mock('./use-hosted-review-actions', () => ({
  useHostedReviewActions: () => ({
    merging: false,
    readying: false,
    stateUpdating: null,
    actionError: null,
    handleMerge,
    handleAutoMerge: vi.fn(),
    handleMarkReadyForReview: vi.fn(),
    handleCloseReview: vi.fn(),
    handleReopenReview: vi.fn()
  })
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: () => null,
  DropdownMenuItem: () => null,
  DropdownMenuSeparator: () => null
}))

afterEach(() => {
  cleanup()
  store.gitStatusByWorktree = {}
})

function renderOpenPR() {
  render(
    <HostedReviewActions
      review={{
        provider: 'github',
        number: 42,
        state: 'open',
        status: 'success',
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        reviewDecision: 'APPROVED'
      }}
      repo={{ id: 'repo-1', path: '/repo' } as Repo}
      worktree={{ id: 'worktree-1' } as Worktree}
      onRefreshReview={vi.fn().mockResolvedValue(undefined)}
    />
  )
  return screen.getAllByRole('button')[0]
}

describe('HostedReviewActions with uncommitted changes', () => {
  it('merges a ready PR from a clean workspace', () => {
    expect(renderOpenPR()).toBeEnabled()
  })

  it('refuses to merge while the workspace has uncommitted changes, and says why', async () => {
    store.gitStatusByWorktree = { 'worktree-1': [{ path: 'a.ts' }, { path: 'b.ts' }] }
    const merge = renderOpenPR()

    expect(merge).toBeDisabled()
    await userEvent.hover(merge.parentElement as HTMLElement)
    expect(
      await screen.findAllByText('Commit your changes before merging (2 uncommitted)')
    ).not.toHaveLength(0)
  })
})
