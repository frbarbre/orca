import { describe, expect, it } from 'vitest'
import {
  collectReviewCommentableLines,
  isRangeInDiff,
  quoteLinesOutsideDiff
} from './review-commentable-lines'

describe('collectReviewCommentableLines', () => {
  const sorted = (lines: ReadonlySet<number>): number[] => [...lines].sort((a, b) => a - b)

  it('includes a changed range and three lines of hunk context each side', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 13, modifiedEndLineNumber: 13 }
    ])
    expect(sorted(lines)).toEqual([10, 11, 12, 13, 14, 15, 16])
  })

  it('stops the context at the first line', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 2, modifiedEndLineNumber: 3 }
    ])
    expect(sorted(lines)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('takes the context around a pure deletion, which has no line of its own', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 7, modifiedEndLineNumber: 0 }
    ])
    expect(sorted(lines)).toEqual([5, 6, 7, 8, 9, 10])
  })

  it('merges several hunks', () => {
    const lines = collectReviewCommentableLines([
      { modifiedStartLineNumber: 1, modifiedEndLineNumber: 1 },
      { modifiedStartLineNumber: 20, modifiedEndLineNumber: 21 }
    ])
    expect(sorted(lines)).toEqual([1, 2, 3, 4, 17, 18, 19, 20, 21, 22, 23, 24])
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
