import { describe, expect, it } from 'vitest'
import { isEditablePublishedReviewComment } from './editable-published-comment'
import type { PRComment } from '../../../../shared/github/comment-types'

function comment(overrides: Partial<PRComment> = {}): PRComment {
  return {
    id: 1,
    author: 'octocat',
    authorAvatarUrl: '',
    body: 'a note',
    createdAt: '2026-01-01T00:00:00Z',
    url: 'https://example.invalid/1',
    threadId: 'PRRT_1',
    reactionSubjectId: 'PRRC_1',
    viewerCanUpdate: true,
    ...overrides
  }
}

describe('isEditablePublishedReviewComment', () => {
  it('accepts an inline comment the provider says this viewer may update', () => {
    expect(isEditablePublishedReviewComment(comment())).toBe(true)
  })

  it('refuses when the provider withholds permission', () => {
    expect(isEditablePublishedReviewComment(comment({ viewerCanUpdate: false }))).toBe(false)
    expect(isEditablePublishedReviewComment(comment({ viewerCanUpdate: undefined }))).toBe(false)
  })

  it('refuses a conversation comment, which the issue endpoint already handles', () => {
    expect(isEditablePublishedReviewComment(comment({ threadId: undefined }))).toBe(false)
  })

  it('refuses without the node id the edit mutation needs to locate the comment', () => {
    expect(isEditablePublishedReviewComment(comment({ reactionSubjectId: undefined }))).toBe(false)
  })
})
