import { describe, expect, it } from 'vitest'
import {
  collectReviewCommentableLines,
  isRangeInDiff,
  quoteLinesOutsideDiff
} from './review-commentable-lines'

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

describe('isRangeInDiff', () => {
  const lines = new Set([10, 11, 12])

  it('accepts a line or range the diff covers, and an unknown diff', () => {
    expect(isRangeInDiff(lines, 11, undefined)).toBe(true)
    expect(isRangeInDiff(lines, 12, 10)).toBe(true)
    expect(isRangeInDiff(null, 86, undefined)).toBe(true)
  })

  it('refuses a line, or a range reaching a line, the diff does not cover', () => {
    expect(isRangeInDiff(lines, 86, undefined)).toBe(false)
    expect(isRangeInDiff(lines, 13, 11)).toBe(false)
  })
})

describe('quoteLinesOutsideDiff', () => {
  it('names the line and quotes its code above the comment', () => {
    expect(
      quoteLinesOutsideDiff({ line: 86, code: 'logo: Icon | null', body: 'Why nullable?' })
    ).toBe('Line 86:\n```\nlogo: Icon | null\n```\n\nWhy nullable?')
  })

  it('names a range', () => {
    expect(
      quoteLinesOutsideDiff({ startLine: 84, line: 85, code: 'a\nb', body: 'Hmm' })
    ).toBe('Lines 84–85:\n```\na\nb\n```\n\nHmm')
  })

  it('fences code that itself contains a fence with a longer one', () => {
    expect(quoteLinesOutsideDiff({ line: 3, code: '```js', body: 'x' })).toBe(
      'Line 3:\n````\n```js\n````\n\nx'
    )
  })
})
