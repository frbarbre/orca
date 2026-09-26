// @vitest-environment happy-dom

import { render } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { setDiffCommentMode } from './diff-comment-mode-memory'
import { useDiffReviewComment } from './use-diff-review-comment'

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addPRReviewComment: vi.fn() })
}))

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const TARGET = {
  repoPath: '/repo',
  repoId: 'repo-1',
  prNumber: 7,
  prRepo: { owner: 'o', repo: 'r' },
  headSha: 'abc'
}

function fakeDiffEditor(
  changes: { modifiedStartLineNumber: number; modifiedEndLineNumber: number }[]
) {
  return {
    getLineChanges: () => changes,
    onDidUpdateDiff: () => ({ dispose: () => undefined })
  }
}

/**
 * Records what every render resolved, so the first entry is what the popover painted.
 * Why not renderHook: it wraps in act, which flushes effects before the assertion and so
 * reports the settled value -- exactly the value that was never in question.
 */
function renderedModes(
  worktreeId: string,
  line: number,
  changes: { modifiedStartLineNumber: number; modifiedEndLineNumber: number }[]
): string[] {
  const seen: string[] = []
  // Why hoisted: the hook keys its diff subscription on this identity, so building one per
  // render re-subscribes forever.
  const editor = fakeDiffEditor(changes)
  function Probe(): React.JSX.Element {
    const review = useDiffReviewComment({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the two methods this fake provides.
      diffEditor: editor as never,
      modelKey: 'model-1',
      target: TARGET,
      relativePath: 'src/a.ts',
      worktreeId
    })
    seen.push(review.resolveMode(line))
    return <div />
  }
  render(<Probe />)
  return seen
}

describe('the destination the popover opens on', () => {
  it('paints the remembered destination on the very first render', () => {
    // Why this test exists: the commentable lines used to start empty and fill in an effect,
    // so the first paint judged every line un-commentable, fell back to the agent tab, and
    // visibly switched a frame later.
    setDiffCommentMode('wt-1', 'pending')

    const modes = renderedModes('wt-1', 11, [
      { modifiedStartLineNumber: 10, modifiedEndLineNumber: 12 }
    ])

    expect(modes[0]).toBe('pending')
    expect(new Set(modes)).toEqual(new Set(['pending']))
  })

  it('still falls back for a line the diff does not carry', () => {
    setDiffCommentMode('wt-2', 'pending')

    const modes = renderedModes('wt-2', 99, [
      { modifiedStartLineNumber: 10, modifiedEndLineNumber: 12 }
    ])

    expect(modes.at(-1)).toBe('note')
  })
})
