// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PRCommentGroup } from '../../../../shared/pr-comment-groups'
import { getPRCommentGroupId } from '../../../../shared/pr-comment-groups'
import { publishPRCommentQueueContext, usePRCommentQueueToggle } from './pr-comment-queue-context'
import {
  clearPRCommentsListSelectionsForTests,
  readPRCommentsListSelectedGroupIds,
  setPRCommentsListGroupQueued
} from './pr-comments-list-selection'

function thread(isResolved = false): PRCommentGroup {
  const root = {
    id: 7,
    author: 'madsenmm',
    authorAvatarUrl: '',
    body: 'Rename this',
    createdAt: '2026-09-29T00:00:00Z',
    url: '',
    path: 'a.ts',
    line: 3,
    threadId: 'T1',
    isResolved
  }
  return { kind: 'thread', threadId: 'T1', root, replies: [] }
}

describe('usePRCommentQueueToggle', () => {
  afterEach(() => clearPRCommentsListSelectionsForTests())

  it('queues a thread for the panel and follows changes made there', () => {
    const group = thread()
    publishPRCommentQueueContext('wt', 'panel-key')
    const { result } = renderHook(() => usePRCommentQueueToggle('wt', group))
    expect(result.current?.queued).toBe(false)

    act(() => result.current?.toggle())
    expect(readPRCommentsListSelectedGroupIds('panel-key').has(getPRCommentGroupId(group))).toBe(
      true
    )
    expect(result.current?.queued).toBe(true)

    act(() => setPRCommentsListGroupQueued('panel-key', getPRCommentGroupId(group), false))
    expect(result.current?.queued).toBe(false)
  })

  it('offers nothing for a resolved thread or before the panel has a queue', () => {
    publishPRCommentQueueContext('wt', 'panel-key')
    expect(renderHook(() => usePRCommentQueueToggle('wt', thread(true))).result.current).toBeNull()
    expect(renderHook(() => usePRCommentQueueToggle('other', thread())).result.current).toBeNull()
  })
})
