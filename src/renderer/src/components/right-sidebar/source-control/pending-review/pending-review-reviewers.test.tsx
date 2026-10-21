// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PullRequestReviewer } from '../../../../../../shared/github/pull-request-reviewers'
import { PendingReviewReviewers } from './pending-review-reviewers'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))

function reviewer(overrides: Partial<PullRequestReviewer>): PullRequestReviewer {
  return {
    kind: 'user',
    login: 'someone',
    name: null,
    avatarUrl: null,
    state: 'pending',
    canRerequest: false,
    ...overrides
  }
}

function renderList(
  reviewers: PullRequestReviewer[] | null,
  onRerequest = vi.fn(async () => true)
) {
  render(
    <TooltipProvider>
      <PendingReviewReviewers reviewers={reviewers} onRerequest={onRerequest} />
    </TooltipProvider>
  )
  return onRerequest
}

describe('PendingReviewReviewers', () => {
  afterEach(cleanup)

  it('renders nothing without reviewers', () => {
    const { container } = render(<PendingReviewReviewers reviewers={[]} onRerequest={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a loading state until the reviewers arrive', () => {
    renderList(null)
    expect(screen.getByRole('status', { name: 'Loading reviewers' })).toBeInTheDocument()
    expect(screen.getByText('Reviewers')).toBeInTheDocument()
  })

  it('offers a re-request only to reviewers who have already reviewed', async () => {
    const onRerequest = renderList([
      reviewer({ login: 'MartinBernstorff', state: 'changes-requested', canRerequest: true }),
      reviewer({ login: 'zahlio', state: 'pending' })
    ])

    expect(screen.getByText('MartinBernstorff')).toBeInTheDocument()
    expect(screen.getByText('zahlio')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Re-request review from zahlio' })).toBeNull()

    await userEvent.click(
      screen.getByRole('button', { name: 'Re-request review from MartinBernstorff' })
    )
    expect(onRerequest).toHaveBeenCalledWith('MartinBernstorff')
  })

  it('holds back a re-request while the workspace has changes that are not committed', async () => {
    const onRerequest = vi.fn(async () => true)
    render(
      <TooltipProvider>
        <PendingReviewReviewers
          reviewers={[reviewer({ login: 'zahlio', state: 'commented', canRerequest: true })]}
          onRerequest={onRerequest}
          uncommittedChanges={2}
        />
      </TooltipProvider>
    )

    const button = screen.getByRole('button', { name: 'Re-request review from zahlio' })
    expect(button).toBeDisabled()
    await userEvent.hover(button.parentElement as HTMLElement)
    expect(
      await screen.findAllByText(
        'Commit your changes before asking for another review (2 uncommitted)'
      )
    ).not.toHaveLength(0)
    expect(onRerequest).not.toHaveBeenCalled()
  })

  it('drops its heading inside the Review section, whose header already says it', () => {
    render(
      <TooltipProvider>
        <PendingReviewReviewers
          reviewers={[reviewer({ login: 'zahlio' })]}
          onRerequest={vi.fn()}
          showHeading={false}
        />
      </TooltipProvider>
    )
    expect(screen.getByText('zahlio')).toBeInTheDocument()
    expect(screen.queryByText('Reviewers')).toBeNull()
  })
})
