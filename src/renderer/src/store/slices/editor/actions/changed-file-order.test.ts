import { describe, expect, it } from 'vitest'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { buildChangedFileOrder, stepChangedFile } from './changed-file-order'

function status(path: string): GitStatusEntry {
  return { path, area: 'unstaged' } as GitStatusEntry
}

function branch(path: string): GitBranchChangeEntry {
  return { path } as GitBranchChangeEntry
}

describe('buildChangedFileOrder', () => {
  it('lists working-tree changes before branch-only changes', () => {
    expect(
      buildChangedFileOrder([status('src/a.ts'), status('src/b.ts')], [branch('src/c.ts')])
    ).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })

  it('visits a path changed both locally and on the branch only once', () => {
    expect(buildChangedFileOrder([status('src/a.ts')], [branch('src/a.ts')])).toEqual(['src/a.ts'])
  })

  it('drops duplicates within the status list, so a staged+unstaged path is one stop', () => {
    expect(buildChangedFileOrder([status('src/a.ts'), status('src/a.ts')], [])).toEqual([
      'src/a.ts'
    ])
  })

  it('is empty when nothing changed', () => {
    expect(buildChangedFileOrder([], [])).toEqual([])
  })
})

describe('stepChangedFile', () => {
  const order = ['a.ts', 'b.ts', 'c.ts']

  it('steps forward and back', () => {
    expect(stepChangedFile(order, 'a.ts', 'next')).toBe('b.ts')
    expect(stepChangedFile(order, 'b.ts', 'previous')).toBe('a.ts')
  })

  it('wraps at both ends so holding the shortcut cycles instead of stalling', () => {
    expect(stepChangedFile(order, 'c.ts', 'next')).toBe('a.ts')
    expect(stepChangedFile(order, 'a.ts', 'previous')).toBe('c.ts')
  })

  it('enters the list from the matching end when the open file is not a changed file', () => {
    expect(stepChangedFile(order, 'untracked-by-git.ts', 'next')).toBe('a.ts')
    expect(stepChangedFile(order, null, 'previous')).toBe('c.ts')
  })

  it('returns null when there is nowhere to go', () => {
    expect(stepChangedFile([], null, 'next')).toBeNull()
    // Why: a lone changed file would otherwise "step" onto itself and reload the diff for no reason.
    expect(stepChangedFile(['only.ts'], 'only.ts', 'next')).toBeNull()
    expect(stepChangedFile(['only.ts'], 'only.ts', 'previous')).toBeNull()
  })

  it('still enters a single-entry list from an unrelated file', () => {
    expect(stepChangedFile(['only.ts'], 'other.ts', 'next')).toBe('only.ts')
  })
})
