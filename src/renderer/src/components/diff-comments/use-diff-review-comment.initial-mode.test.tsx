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
  changes: { modifiedStartLineNumber: number; modifiedEndLineNumber: number }[],
  target: typeof TARGET | null = TARGET
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
      target,
      relativePath: 'src/a.ts',
      worktreeId
    })
    seen.push(review.resolvedMode)
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

    const modes = renderedModes('wt-1', [{ modifiedStartLineNumber: 10, modifiedEndLineNumber: 12 }])

    expect(modes[0]).toBe('pending')
    expect(new Set(modes)).toEqual(new Set(['pending']))
  })

  it('falls back to notes when the diff is not part of a pull request', () => {
    setDiffCommentMode('wt-2', 'pending')

    const modes = renderedModes(
      'wt-2',
      [{ modifiedStartLineNumber: 10, modifiedEndLineNumber: 12 }],
      null
    )

    expect(modes.at(-1)).toBe('note')
  })
})

describe('a comment on a line the diff does not carry', () => {
  function probe(line: number, startLine?: number) {
    const editor = {
      ...fakeDiffEditor([{ modifiedStartLineNumber: 10, modifiedEndLineNumber: 12 }]),
      getModifiedEditor: () => ({
        getModel: () => ({
          getLineMaxColumn: () => 18,
          getValueInRange: (range: { startLineNumber: number; endLineNumber: number }) =>
            range.startLineNumber === range.endLineNumber
              ? 'logo: Icon | null'
              : 'text: string\nlogo: Icon | null'
        })
      })
    }
    let result: { body: string; subjectType?: 'file' } | undefined
    function Probe(): React.JSX.Element {
      const review = useDiffReviewComment({
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the methods this fake provides.
        diffEditor: editor as never,
        modelKey: 'model-1',
        target: TARGET,
        relativePath: 'src/a.ts',
        worktreeId: 'wt-3'
      })
      result = review.prepareReviewComment(line, startLine, 'Why nullable?')
      return <div />
    }
    render(<Probe />)
    return result
  }

  it('becomes a file comment quoting the line', () => {
    expect(probe(86)).toEqual({
      body: 'Line 86:\n```\nlogo: Icon | null\n```\n\nWhy nullable?',
      subjectType: 'file'
    })
  })

  it('stays a line comment inside the diff', () => {
    expect(probe(11)).toEqual({ body: 'Why nullable?' })
  })
})
