// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PRComment } from '../../../../../shared/github/comment-types'
import { getPRCommentPresentationClasses } from '../pr-comment-presentation'
import { CommentRow } from './comment-row'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

function renderRow(overrides: Partial<PRComment>) {
  render(
    <CommentRow
      comment={{
        id: 1,
        author: 'madsenmm',
        authorAvatarUrl: '',
        body: 'Frontend is good, nice',
        createdAt: '2026-01-01T00:00:00.000Z',
        url: 'https://example.test/1',
        ...overrides
      }}
      botAuthorOverrides={new Set()}
      isReply={false}
      showResolve={false}
      actionState="open"
      isQueued={false}
      presentation={getPRCommentPresentationClasses()}
      now={Date.parse('2026-01-01T00:05:00.000Z')}
      onEditComment={vi.fn(async () => true)}
      onDeleteComment={vi.fn()}
    />
  )
}

async function openMoreMenu(): Promise<void> {
  const trigger = screen.getByRole('button', { name: 'More comment actions' })
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  })
}

afterEach(cleanup)

describe('a review summary', () => {
  it.each([
    ['approved', 'Approved'],
    ['changes-requested', 'Changes requested'],
    ['commented', 'Commented']
  ] as const)('says the review %s', (reviewState, label) => {
    renderRow({ reviewState })

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('can be edited, not deleted, when GitHub lets this viewer update it', async () => {
    renderRow({
      reviewState: 'commented',
      viewerCanUpdate: true,
      reactionSubjectId: 'PRR_1',
      url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1'
    })
    await openMoreMenu()

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('cannot be edited when GitHub does not let this viewer update it', async () => {
    renderRow({
      reviewState: 'commented',
      viewerCanUpdate: false,
      reactionSubjectId: 'PRR_1',
      url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1'
    })
    await openMoreMenu()

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('offers Delete on an inline review comment GitHub lets this viewer delete', async () => {
    renderRow({
      path: 'src/a.ts',
      threadId: 'PRRT_1',
      reactionSubjectId: 'PRRC_1',
      viewerCanUpdate: true,
      viewerCanDelete: true
    })
    await openMoreMenu()

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
  })

  it('withholds Delete on an inline review comment GitHub does not let this viewer delete', async () => {
    renderRow({
      path: 'src/a.ts',
      threadId: 'PRRT_1',
      reactionSubjectId: 'PRRC_1',
      viewerCanUpdate: true,
      viewerCanDelete: false
    })
    await openMoreMenu()

    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('leaves a plain comment unmarked', () => {
    renderRow({})

    expect(screen.queryByText('Approved')).not.toBeInTheDocument()
    expect(screen.queryByText('Changes requested')).not.toBeInTheDocument()
    expect(screen.queryByText('Commented')).not.toBeInTheDocument()
  })
})
