// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../../shared/repo-types'
import { ChecksPanelReviewHeader } from './review-header'
import { TooltipProvider } from '@/components/ui/tooltip'

const handleCloseReview = vi.hoisted(() => vi.fn())
vi.mock('../use-hosted-review-state-change', () => ({
  useHostedReviewStateChange: () => ({
    stateUpdating: null,
    handleCloseReview,
    handleReopenReview: vi.fn()
  })
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled
  }: {
    children: ReactNode
    onSelect?: () => void
    disabled?: boolean
  }) => (
    <button type="button" disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />
}))

afterEach(cleanup)

function renderHeader(state: 'open' | 'merged', closeReview = true) {
  render(
    <TooltipProvider>
      <ChecksPanelReviewHeader
        review={{ provider: 'github', number: 42, state } as never}
        isRefreshing={false}
        canUnlinkReview
        modifierHintDestination={null as never}
        onRefresh={vi.fn()}
        onOpenReview={vi.fn()}
        onUnlinkReview={vi.fn()}
        onLinkAnotherReview={vi.fn()}
        closeReview={
          closeReview
            ? {
                repo: { id: 'repo-1', path: '/repo' } as Repo,
                githubPR: null,
                onRefreshReview: vi.fn().mockResolvedValue(undefined)
              }
            : null
        }
      />
    </TooltipProvider>
  )
}

describe('ChecksPanelReviewHeader close action', () => {
  it('closes an open PR from the More actions menu', async () => {
    renderHeader('open')

    await userEvent.click(screen.getByRole('button', { name: /Close PR/ }))
    expect(handleCloseReview).toHaveBeenCalledOnce()
  })

  it('offers no close for a PR that is already merged or has no repository', () => {
    renderHeader('merged')
    expect(screen.queryByRole('button', { name: /Close PR/ })).toBeNull()
    cleanup()
    renderHeader('open', false)
    expect(screen.queryByRole('button', { name: /Close PR/ })).toBeNull()
  })
})
