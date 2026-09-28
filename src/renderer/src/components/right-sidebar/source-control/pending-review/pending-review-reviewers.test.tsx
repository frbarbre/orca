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

function renderList(reviewers: PullRequestReviewer[], onRerequest = vi.fn(async () => true)) {
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
})
