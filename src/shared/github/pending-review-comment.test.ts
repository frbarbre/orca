import { describe, expect, it } from 'vitest'
import {
  addPendingReviewComment,
  canSubmitReviewVerdict,
  normalizePendingReviewComments,
  pendingReviewCommentsForPath,
  removePendingReviewComment,
  updatePendingReviewCommentBody,
  type PendingReviewComment
} from './pending-review-comment'

function draft(overrides: Partial<PendingReviewComment> = {}): PendingReviewComment {
  return {
    id: 'a',
    path: 'src/app.ts',
    line: 12,
    body: 'this leaks',
    createdAt: 1,
    ...overrides
  }
}

describe('the pending review queue', () => {
  it('appends, edits and removes by id', () => {
    const one = addPendingReviewComment([], draft())
    const two = addPendingReviewComment(one, draft({ id: 'b', line: 20 }))

    expect(updatePendingReviewCommentBody(two, 'b', 'reworded')[1].body).toBe('reworded')
    expect(removePendingReviewComment(two, 'a').map((c) => c.id)).toEqual(['b'])
  })

  it('leaves the queue alone when the id is unknown', () => {
    const queue = [draft()]

    expect(removePendingReviewComment(queue, 'nope')).toEqual(queue)
    expect(updatePendingReviewCommentBody(queue, 'nope', 'x')).toEqual(queue)
  })

  it('selects only the drafts for one file', () => {
    const queue = [draft(), draft({ id: 'b', path: 'src/other.ts' })]

    expect(pendingReviewCommentsForPath(queue, 'src/app.ts').map((c) => c.id)).toEqual(['a'])
  })
})

describe('normalizePendingReviewComments', () => {
  it('drops entries that could not anchor a comment', () => {
    const queue = normalizePendingReviewComments([
      draft(),
      { id: '', path: 'a', line: 1, body: 'x' },
      { id: 'b', path: '', line: 1, body: 'x' },
      { id: 'c', path: 'a', body: 'x' },
      { id: 'd', path: 'a', line: 1 },
      null,
      'nope'
    ])

    expect(queue.map((c) => c.id)).toEqual(['a'])
  })

  it('drops a start line equal to the line, so a single-line draft stays single-line', () => {
    const [comment] = normalizePendingReviewComments([draft({ startLine: 12 })])

    expect(comment.startLine).toBeUndefined()
  })

  it('keeps a real multi-line range', () => {
    const [comment] = normalizePendingReviewComments([draft({ startLine: 9 })])

    expect(comment.startLine).toBe(9)
  })

  it('returns an empty queue for anything that is not a list', () => {
    expect(normalizePendingReviewComments(undefined)).toEqual([])
    expect(normalizePendingReviewComments({ id: 'a' })).toEqual([])
  })
})

describe('canSubmitReviewVerdict', () => {
  it('refuses request-changes without a body', () => {
    expect(canSubmitReviewVerdict({ verdict: 'request-changes', body: ' ', pendingCount: 3 })).toBe(
      false
    )
    expect(
      canSubmitReviewVerdict({ verdict: 'request-changes', body: 'no', pendingCount: 3 })
    ).toBe(true)
  })

  it('allows approve with no body at all', () => {
    expect(canSubmitReviewVerdict({ verdict: 'approve', body: '', pendingCount: 0 })).toBe(false)
    expect(canSubmitReviewVerdict({ verdict: 'approve', body: '', pendingCount: 1 })).toBe(true)
    expect(canSubmitReviewVerdict({ verdict: 'approve', body: 'ship it', pendingCount: 0 })).toBe(
      true
    )
  })

  it('refuses an empty comment review', () => {
    expect(canSubmitReviewVerdict({ verdict: 'comment', body: '   ', pendingCount: 0 })).toBe(false)
  })
})
