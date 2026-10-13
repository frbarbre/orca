// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
        createdAt: new Date().toISOString(),
        url: 'https://example.test/1',
        ...overrides
      }}
      botAuthorOverrides={new Set()}
      isReply={false}
      showResolve={false}
      actionState="open"
      isQueued={false}
      presentation={getPRCommentPresentationClasses()}
      now={Date.now()}
    />
  )
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

  it('leaves a plain comment unmarked', () => {
    renderRow({})

    expect(screen.queryByText('Approved')).not.toBeInTheDocument()
    expect(screen.queryByText('Changes requested')).not.toBeInTheDocument()
    expect(screen.queryByText('Commented')).not.toBeInTheDocument()
  })
})
