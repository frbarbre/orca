import { describe, expect, it } from 'vitest'
import { isReviewedCommit, markReviewedCommit } from './reviewed-commit-bases'

describe('reviewed commit bases', () => {
  it('recognises a marked commit whatever its case', () => {
    markReviewedCommit('084E70825EE06CC0EF08C9B09F6378ADF2179BFE')

    expect(isReviewedCommit('084e70825ee06cc0ef08c9b09f6378adf2179bfe')).toBe(true)
  })

  it('leaves unmarked and empty commits to the normal rules', () => {
    expect(isReviewedCommit('1111111111111111111111111111111111111111')).toBe(false)
    expect(isReviewedCommit(null)).toBe(false)
    markReviewedCommit(null)
    expect(isReviewedCommit('')).toBe(false)
  })
})
