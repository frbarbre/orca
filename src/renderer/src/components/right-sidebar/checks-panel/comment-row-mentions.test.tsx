// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPRCommentPresentationClasses } from '../pr-comment-presentation'
import { CommentRow } from './comment-row'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

afterEach(cleanup)

describe('a PR comment that mentions someone', () => {
  it('marks the mention so hovering it can say who they are', () => {
    const { container } = render(
      <CommentRow
        comment={{
          id: 1,
          author: 'zahlio',
          authorAvatarUrl: '',
          body: '@madsenmm Remember to only use the token',
          createdAt: '2026-01-01T00:00:00.000Z',
          url: 'https://example.test/1'
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

    expect(container.querySelector('[data-github-mention="madsenmm"]')?.textContent).toBe(
      '@madsenmm'
    )
  })
})
