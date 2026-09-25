import { describe, expect, it } from 'vitest'
import { collectReviewCommentableLines } from './review-commentable-lines'

describe('collectReviewCommentableLines', () => {
  it('includes every line of a changed range', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 3, modifiedEndLineNumber: 5 }
    ])
    expect([...lines]).toEqual([3, 4, 5])
  })

  it('skips a pure deletion, which has no line on the modified side', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 7, modifiedEndLineNumber: 0 }
    ])
    expect(lines.size).toBe(0)
  })

  it('merges several hunks', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 1, modifiedEndLineNumber: 1 },
      { modifiedStartLineNumber: 10, modifiedEndLineNumber: 11 }
    ])
    expect([...lines].sort((a, b) => a - b)).toEqual([1, 10, 11])
  })

  it('is empty when the diff has not been computed yet', () => {
    expect(collectReviewCommentableLines(null).size).toBe(0)
    expect(collectReviewCommentableLines(undefined).size).toBe(0)
    expect(collectReviewCommentableLines([]).size).toBe(0)
  })
})
