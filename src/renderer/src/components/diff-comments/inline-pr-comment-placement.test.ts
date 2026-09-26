import { describe, expect, it } from 'vitest'
import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import { selectInlinePRCommentPlacements } from './inline-pr-comment-placement'
import type { PRCommentGroup } from '../../../../shared/pr-comment-groups'
import type { PRComment } from '../../../../shared/github/comment-types'

function comment(overrides: Partial<PRComment>): PRComment {
  return {
    id: 1,
    author: 'a',
    authorAvatarUrl: '',
    body: 'b',
    createdAt: '',
    url: '',
    ...overrides
  }
}

function thread(overrides: Partial<PRComment>): PRCommentGroup {
  return {
    kind: 'thread',
    threadId: String(overrides.id ?? 1),
    root: comment({ threadId: String(overrides.id ?? 1), ...overrides }),
    replies: []
  }
}

describe('selectInlinePRCommentPlacements', () => {
  it('places a thread on the line it was left on', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 12 })]
    expect(selectInlinePRCommentPlacements(groups, 'src/a.ts', 100)).toEqual([
      { kind: 'thread', id: 'thread:1', lineNumber: 12, group: groups[0], resolved: false }
    ])
  })

  it('drops a thread GitHub marked outdated, which the panel still lists', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 12, isOutdated: true })]
    expect(selectInlinePRCommentPlacements(groups, 'src/a.ts', 100)).toEqual([])
  })

  it('drops a thread whose line is past the end of the file', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 500 })]
    expect(selectInlinePRCommentPlacements(groups, 'src/a.ts', 100)).toEqual([])
  })

  it('ignores threads on other files and conversation comments with no path', () => {
    const groups = [
      thread({ id: 1, path: 'src/b.ts', line: 3 }),
      thread({ id: 2, line: 3 }),
      thread({ id: 3, path: 'src/a.ts', line: 3 })
    ]
    expect(selectInlinePRCommentPlacements(groups, 'src/a.ts', 100).map((p) => p.id)).toEqual([
      'thread:3'
    ])
  })

  it('drops a thread with no line, which cannot be anchored', () => {
    expect(
      selectInlinePRCommentPlacements([thread({ id: 1, path: 'src/a.ts' })], 'src/a.ts', 100)
    ).toEqual([])
  })

  it('reports the resolved state so the zone can render collapsed', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 4, isResolved: true })]
    const [placement] = selectInlinePRCommentPlacements(groups, 'src/a.ts', 100)
    expect(placement?.kind === 'thread' && placement.resolved).toBe(true)
  })

  it('orders by line rather than fetch order', () => {
    const groups = [
      thread({ id: 1, path: 'src/a.ts', line: 30 }),
      thread({ id: 2, path: 'src/a.ts', line: 10 })
    ]
    expect(
      selectInlinePRCommentPlacements(groups, 'src/a.ts', 100).map((p) => p.lineNumber)
    ).toEqual([10, 30])
  })

  it('returns nothing without a path or a loaded model', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 4 })]
    expect(selectInlinePRCommentPlacements(groups, '', 100)).toEqual([])
    expect(selectInlinePRCommentPlacements(groups, 'src/a.ts', 0)).toEqual([])
  })
})

describe('pending review comments', () => {
  const draft = (overrides: Partial<PendingReviewComment> = {}): PendingReviewComment => ({
    id: 'p1',
    path: 'src/a.ts',
    line: 20,
    body: 'queued',
    createdAt: 1,
    ...overrides
  })

  it('places a queued comment on its line', () => {
    const [placement] = selectInlinePRCommentPlacements([], 'src/a.ts', 100, [draft()])

    expect(placement).toMatchObject({ kind: 'pending', lineNumber: 20, id: 'pending:p1' })
  })

  it('leaves queued comments for other files alone', () => {
    expect(
      selectInlinePRCommentPlacements([], 'src/a.ts', 100, [draft({ path: 'src/b.ts' })])
    ).toEqual([])
  })

  it('drops a queued comment past the end of the diff', () => {
    expect(selectInlinePRCommentPlacements([], 'src/a.ts', 10, [draft({ line: 50 })])).toEqual([])
  })

  it('interleaves queued comments with threads in line order', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 30 })]
    const placements = selectInlinePRCommentPlacements(groups, 'src/a.ts', 100, [
      draft({ id: 'p1', line: 10 }),
      draft({ id: 'p2', line: 40 })
    ])

    expect(placements.map((p) => [p.kind, p.lineNumber])).toEqual([
      ['pending', 10],
      ['thread', 30],
      ['pending', 40]
    ])
  })

  it('keeps a queued comment and a thread on the same line, thread first', () => {
    const groups = [thread({ id: 1, path: 'src/a.ts', line: 12 })]
    const placements = selectInlinePRCommentPlacements(groups, 'src/a.ts', 100, [
      draft({ line: 12 })
    ])

    expect(placements.map((p) => p.kind)).toEqual(['thread', 'pending'])
  })
})
