// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  consumeReviewSummaryFocusRequest,
  requestReviewSummaryFocus
} from '@/components/pending-review/review-summary-focus'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PendingReviewQueue } from '@/components/pending-review/use-pending-review-queue'
import type { ReviewVerdictSubmitter } from '@/components/pending-review/use-submit-review-verdict'
import { SourceControlPendingReviewShelf } from './pending-review-shelf'
import { useAppStore } from '@/store'

vi.mock('@/components/pending-review/use-review-diff-base', () => ({
  useReviewDiffBase: () => ({ available: false })
}))
vi.mock('@/components/pending-review/pending-review-summary-store', () => ({
  usePendingReviewSummary: () => ['', vi.fn()]
}))
vi.mock('@/components/github/ReviewMarkdownComposer', () => ({
  ReviewMarkdownComposer: ({
    placeholder,
    onEscape
  }: {
    placeholder: string
    onEscape?: () => void
  }) => (
    <textarea
      placeholder={placeholder}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onEscape?.()
        }
      }}
    />
  )
}))

afterEach(cleanup)

function ToggleableShelf(props: { queue: PendingReviewQueue; submitter: ReviewVerdictSubmitter }) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <SourceControlPendingReviewShelf
      {...props}
      worktreeId="wt"
      collapsed={collapsed}
      onToggle={() => setCollapsed((current) => !current)}
    />
  )
}

function renderShelf(
  collapsed: boolean | 'toggleable',
  comments: PendingReviewQueue['comments'] = [],
  reviewer: { canRerequest?: boolean; state?: string } = {}
) {
  const queue = {
    comments,
    updateBody: vi.fn(),
    remove: vi.fn()
  } as unknown as PendingReviewQueue
  const submitter = {
    prNumber: 7,
    reviewers: [
      {
        kind: 'user',
        login: 'MartinBernstorff',
        name: null,
        avatarUrl: null,
        state: 'pending',
        canRerequest: false,
        ...reviewer
      }
    ],
    rerequest: vi.fn(),
    viewerDidAuthor: false,
    viewerLatestReviewState: null,
    viewerHasReviewRequest: false,
    commits: [],
    viewerReviews: [],
    baseRefName: 'main',
    submit: vi.fn()
  } as unknown as ReviewVerdictSubmitter
  render(
    <TooltipProvider>
      {collapsed === 'toggleable' ? (
        <ToggleableShelf queue={queue} submitter={submitter} />
      ) : (
        <SourceControlPendingReviewShelf
          queue={queue}
          submitter={submitter}
          worktreeId="wt"
          collapsed={collapsed}
          onToggle={vi.fn()}
        />
      )}
    </TooltipProvider>
  )
}

describe('SourceControlPendingReviewShelf', () => {
  it('is one Review section holding the reviewers and the review form', () => {
    renderShelf(false)
    expect(screen.getByRole('button', { name: /Review/ })).toBeInTheDocument()
    expect(screen.getByText('MartinBernstorff')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add review summary…')).toBeInTheDocument()
  })

  it('leaves your unsent review comments to their own Pending review section', () => {
    renderShelf(false, [{ id: 'd1', path: 'a.ts', line: 3, body: 'Rename this', createdAt: 1 }])
    expect(screen.queryByRole('button', { name: /Pending review/ })).toBeNull()
  })

  it('collapses to its header', () => {
    renderShelf(true)
    expect(screen.queryByText('MartinBernstorff')).toBeNull()
    expect(screen.queryByPlaceholderText('Add review summary…')).toBeNull()
  })

  it('focuses the review summary when asked', () => {
    renderShelf(false)
    act(() => requestReviewSummaryFocus('wt'))
    expect(screen.getByPlaceholderText('Add review summary…')).toHaveFocus()
    expect(consumeReviewSummaryFocusRequest('wt')).toBe(false)
  })

  it('lets go of the review summary on Escape', () => {
    renderShelf(false)
    const summary = screen.getByPlaceholderText('Add review summary…')
    act(() => summary.focus())
    fireEvent.keyDown(summary, { key: 'Escape' })
    expect(summary).not.toHaveFocus()
  })

  it('opens a collapsed Review section to focus its summary', () => {
    renderShelf('toggleable')
    act(() => requestReviewSummaryFocus('wt'))
    expect(screen.getByPlaceholderText('Add review summary…')).toHaveFocus()
  })

  it("holds back a re-request while the workspace's changes are not committed", () => {
    useAppStore.setState({
      gitStatusByWorktree: { wt: [{ path: 'a.ts' }, { path: 'b.ts' }] as never }
    })
    renderShelf(false, [], { canRerequest: true, state: 'commented' })

    expect(
      screen.getByRole('button', { name: 'Re-request review from MartinBernstorff' })
    ).toBeDisabled()
    useAppStore.setState({ gitStatusByWorktree: {} })
  })
})
