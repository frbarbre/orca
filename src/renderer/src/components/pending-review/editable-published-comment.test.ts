import { describe, expect, it } from 'vitest'
import {
  isDeletablePublishedReviewComment,
  isEditablePublishedReviewComment,
  isEditablePublishedReviewSummary
} from './editable-published-comment'
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

describe('isDeletablePublishedReviewComment', () => {
  it('accepts an inline comment the provider says this viewer may delete', () => {
    expect(isDeletablePublishedReviewComment(comment({ viewerCanDelete: true }))).toBe(true)
  })

  it('refuses when the provider withholds permission', () => {
    expect(isDeletablePublishedReviewComment(comment({ viewerCanDelete: false }))).toBe(false)
    expect(isDeletablePublishedReviewComment(comment())).toBe(false)
  })

  it('refuses a conversation comment and one without a node id', () => {
    expect(
      isDeletablePublishedReviewComment(comment({ viewerCanDelete: true, threadId: undefined }))
    ).toBe(false)
    expect(
      isDeletablePublishedReviewComment(
        comment({ viewerCanDelete: true, reactionSubjectId: undefined })
      )
    ).toBe(false)
  })
})

describe('isEditablePublishedReviewSummary', () => {
  const summary = (overrides: Partial<PRComment> = {}): PRComment =>
    comment({
      threadId: undefined,
      reactionSubjectId: 'PRR_1',
      reviewState: 'commented',
      url: 'https://github.com/acme/widgets/pull/7#pullrequestreview-1',
      ...overrides
    })

  it("accepts a review's summary the provider says this viewer may update", () => {
    expect(isEditablePublishedReviewSummary(summary())).toBe(true)
  })

  it('refuses without permission, without the node id, or for anything but a review', () => {
    expect(isEditablePublishedReviewSummary(summary({ viewerCanUpdate: false }))).toBe(false)
    expect(isEditablePublishedReviewSummary(summary({ reactionSubjectId: undefined }))).toBe(false)
    expect(isEditablePublishedReviewSummary(summary({ reviewState: undefined }))).toBe(false)
    expect(isEditablePublishedReviewSummary(comment())).toBe(false)
  })
})
