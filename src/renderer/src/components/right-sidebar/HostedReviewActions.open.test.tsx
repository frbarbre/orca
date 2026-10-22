// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import HostedReviewActions from './HostedReviewActions'

vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ deleteStateByWorktreeId: {} })
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

afterEach(cleanup)

describe('HostedReviewActions on an open PR', () => {
  it("leaves merging to the top bar's next-action button, so the panel shows no merge button", () => {
    const { container } = render(
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

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container).toBeEmptyDOMElement()
  })
})
