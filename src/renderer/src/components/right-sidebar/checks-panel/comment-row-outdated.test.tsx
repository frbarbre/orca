// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PRComment } from '../../../../../shared/github/comment-types'
import { getPRCommentPresentationClasses } from '../pr-comment-presentation'
import { CommentRow } from './comment-row'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

function comment(overrides: Partial<PRComment> = {}): PRComment {
  return {
    id: 1,
    author: 'frbarbre',
    authorAvatarUrl: '',
    body: 'this needs a second look',
    createdAt: new Date().toISOString(),
    url: 'https://example.test/1',
    path: 'src/app.ts',
    line: 12,
    threadId: 'T_1',
    ...overrides
  }
}

function renderRow(overrides: Partial<PRComment>, onOpenLocation = vi.fn()) {
  render(
    <CommentRow
      comment={comment(overrides)}
      botAuthorOverrides={new Set()}
      isReply={false}
      showResolve={false}
      actionState="open"
      isQueued={false}
      presentation={getPRCommentPresentationClasses()}
      now={Date.now()}
      onOpenLocation={onOpenLocation}
    />
  )
}

afterEach(cleanup)

describe('a comment the provider can no longer place', () => {
  it('is badged outdated', () => {
    renderRow({ isOutdated: true })

    expect(screen.getByText('Outdated')).toBeInTheDocument()
  })

  it('offers no link to the line, because there is no line left to open', () => {
    renderRow({ isOutdated: true })

    expect(screen.queryByRole('button', { name: /app\.ts/ })).not.toBeInTheDocument()
  })

  it('still links the line when the comment is current', () => {
    renderRow({})

    expect(screen.queryByText('Outdated')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /app\.ts/ })).toBeInTheDocument()
  })
})
