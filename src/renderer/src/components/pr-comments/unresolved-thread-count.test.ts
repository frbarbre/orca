import { describe, expect, it } from 'vitest'
import {
  buildUnresolvedThreadCountByPath,
  countUnresolvedThreadsForPath
} from './unresolved-thread-count'
import type { PRCommentGroup } from '../../../../shared/pr-comment-groups'
import type { PRComment } from '../../../../shared/github/comment-types'

function thread(overrides: Partial<PRComment>, replies = 0): PRCommentGroup {
  const base: PRComment = {
    id: overrides.id ?? 1,
    author: 'a',
    authorAvatarUrl: '',
    body: 'b',
    createdAt: '',
    url: '',
    threadId: String(overrides.id ?? 1),
    ...overrides
  }
  return {
    kind: 'thread',
    threadId: base.threadId as string,
    root: base,
    replies: Array.from({ length: replies }, (_, i) => ({ ...base, id: base.id * 100 + i }))
  }
}

const PATH = 'src/a.ts'

describe('countUnresolvedThreadsForPath', () => {
  it('counts an unresolved thread on the file', () => {
    expect(countUnresolvedThreadsForPath([thread({ id: 1, path: PATH })], PATH)).toBe(1)
  })

  it('ignores resolved threads, which need nothing from the reader', () => {
    expect(
      countUnresolvedThreadsForPath([thread({ id: 1, path: PATH, isResolved: true })], PATH)
    ).toBe(0)
  })

  it('ignores outdated threads, which the diff does not render', () => {
    expect(
      countUnresolvedThreadsForPath([thread({ id: 1, path: PATH, isOutdated: true })], PATH)
    ).toBe(0)
  })

  it('counts a conversation once, however many replies it has', () => {
    expect(countUnresolvedThreadsForPath([thread({ id: 1, path: PATH }, 8)], PATH)).toBe(1)
  })

  it('ignores other files and comments with no path', () => {
    const groups = [
      thread({ id: 1, path: 'src/b.ts' }),
      thread({ id: 2 }),
      thread({ id: 3, path: PATH })
    ]
    expect(countUnresolvedThreadsForPath(groups, PATH)).toBe(1)
  })

  it('is zero for no groups or no path, so the badge stays hidden', () => {
    expect(countUnresolvedThreadsForPath([], PATH)).toBe(0)
    expect(countUnresolvedThreadsForPath([thread({ id: 1, path: PATH })], '')).toBe(0)
  })
})

describe('buildUnresolvedThreadCountByPath', () => {
  it('counts per file, skipping resolved and outdated', () => {
    const counts = buildUnresolvedThreadCountByPath([
      thread({ id: 1, path: 'src/a.ts' }),
      thread({ id: 2, path: 'src/a.ts' }),
      thread({ id: 3, path: 'src/a.ts', isResolved: true }),
      thread({ id: 4, path: 'src/b.ts', isOutdated: true }),
      thread({ id: 5, path: 'src/c.ts' })
    ])
    expect(counts.get('src/a.ts')).toBe(2)
    expect(counts.has('src/b.ts')).toBe(false)
    expect(counts.get('src/c.ts')).toBe(1)
  })

  it('omits comments with no file, so a conversation comment cannot land on a row', () => {
    expect(buildUnresolvedThreadCountByPath([thread({ id: 1 })]).size).toBe(0)
  })
})
