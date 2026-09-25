import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDiffCommentMode,
  getDiffCommentMode,
  setDiffCommentMode
} from './diff-comment-mode-memory'

describe('diff comment mode memory', () => {
  beforeEach(() => {
    clearDiffCommentMode('a')
    clearDiffCommentMode('b')
  })

  it('defaults to a note, which is the destination that cannot surprise a colleague', () => {
    expect(getDiffCommentMode('a')).toBe('note')
  })

  it('remembers the choice for the next file in the same worktree', () => {
    setDiffCommentMode('a', 'review')
    expect(getDiffCommentMode('a')).toBe('review')
  })

  it('keeps worktrees apart, since one may be a review and another your own work', () => {
    setDiffCommentMode('a', 'review')
    expect(getDiffCommentMode('b')).toBe('note')
  })

  it('treats a missing worktree as the default and ignores writes to it', () => {
    setDiffCommentMode(null, 'review')
    expect(getDiffCommentMode(null)).toBe('note')
  })
})
