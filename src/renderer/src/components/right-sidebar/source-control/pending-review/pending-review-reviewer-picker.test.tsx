// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PullRequestReviewer } from '../../../../../../shared/github/pull-request-reviewers'

const mocks = vi.hoisted(() => ({ useRepoAssignees: vi.fn() }))

vi.mock('@/hooks/useIssueMetadata', () => ({ useRepoAssignees: mocks.useRepoAssignees }))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => values?.[name] ?? '')
}))

import { PendingReviewReviewerPicker } from './pending-review-reviewer-picker'

const user = (login: string) => ({ login, name: null, avatarUrl: '' })

function reviewer(login: string, overrides: Partial<PullRequestReviewer>): PullRequestReviewer {
  return {
    kind: 'user',
    login,
    name: null,
    avatarUrl: null,
    state: 'pending',
    canRerequest: false,
    canRemove: true,
    ...overrides
  }
}

function renderPicker() {
  mocks.useRepoAssignees.mockReturnValue({
    data: [user('frbarbre'), user('zahlio'), user('MartinBernstorff'), user('colleague')],
    loading: false,
    error: null
  })
  const onRequest = vi.fn(async () => true)
  const onRemove = vi.fn(async () => true)
  render(
    <PendingReviewReviewerPicker
      repo={{ path: '/repo', id: 'repo-1' }}
      authorLogin="frbarbre"
      reviewers={[
        reviewer('zahlio', {}),
        reviewer('MartinBernstorff', { state: 'approved', canRerequest: true, canRemove: false })
      ]}
      onRequest={onRequest}
      onRemove={onRemove}
    />
  )
  return { onRequest, onRemove }
}

describe('PendingReviewReviewerPicker', () => {
  afterEach(cleanup)

  it('requests people who have not reviewed, and unrequests a pending one', async () => {
    const { onRequest, onRemove } = renderPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Reviewer' }))

    expect(screen.queryByRole('button', { name: /frbarbre/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /MartinBernstorff/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Request reviewer colleague' }))
    expect(onRequest).toHaveBeenCalledWith(['colleague'])

    await userEvent.click(screen.getByRole('button', { name: 'Unrequest reviewer zahlio' }))
    expect(onRemove).toHaveBeenCalledWith('zahlio')
  })

  it('requests a typed team by org and slug', async () => {
    const { onRequest } = renderPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Reviewer' }))
    await userEvent.type(screen.getByRole('combobox'), 'acme/backend{Enter}')

    expect(onRequest).toHaveBeenCalledWith(['acme/backend'])
  })
})
