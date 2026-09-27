// @vitest-environment happy-dom

import React from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { PRComment } from '../../../../shared/github/comment-types'
import { PRCommentsProvider, usePRCommentsState } from './pr-comments-store'

const COMMENT: PRComment = {
  id: 1,
  author: 'octocat',
  authorAvatarUrl: '',
  body: 'Looks good',
  createdAt: '2026-09-27T00:00:00Z',
  url: ''
}

const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <PRCommentsProvider>{children}</PRCommentsProvider>
)

describe('usePRCommentsState', () => {
  afterEach(() => cleanup())

  it('keeps its setters stable while the comments it holds change', () => {
    const { result } = renderHook(() => usePRCommentsState('pr-1'), { wrapper })
    const { setComments, setCommentsLoading } = result.current

    act(() => setCommentsLoading(true))
    act(() => setComments([COMMENT]))
    act(() => setCommentsLoading(false))

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.setComments).toBe(setComments)
    expect(result.current.setCommentsLoading).toBe(setCommentsLoading)
  })

  it('keeps its setters stable without a provider', () => {
    const { result } = renderHook(() => usePRCommentsState('pr-1'))
    const { setComments, setCommentsLoading } = result.current

    act(() => setComments([COMMENT]))

    expect(result.current.comments).toHaveLength(1)
    expect(result.current.setComments).toBe(setComments)
    expect(result.current.setCommentsLoading).toBe(setCommentsLoading)
  })
})
