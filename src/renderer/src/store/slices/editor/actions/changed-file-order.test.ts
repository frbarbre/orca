import { describe, expect, it } from 'vitest'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import {
  buildChangedFileOrder,
  parseChangedFileRowKey,
  resolveCurrentRowKey,
  stepChangedFile
} from './changed-file-order'

function status(path: string, area = 'unstaged'): GitStatusEntry {
  return { path, area } as GitStatusEntry
}

function branch(path: string): GitBranchChangeEntry {
  return { path } as GitBranchChangeEntry
}

describe('buildChangedFileOrder', () => {
  it('lists working-tree rows before branch rows', () => {
    expect(
      buildChangedFileOrder([status('src/a.ts'), status('src/b.ts')], [branch('src/c.ts')])
    ).toEqual(['unstaged::src/a.ts', 'unstaged::src/b.ts', 'branch::src/c.ts'])
  })

  it('keeps both rows for a path changed in the working tree and on the branch', () => {
    // Why this is the interesting case: these are two rows the user can visit separately, and
    // deduping them by path made the branch row unreachable by keyboard.
    expect(buildChangedFileOrder([status('src/a.ts')], [branch('src/a.ts')])).toEqual([
      'unstaged::src/a.ts',
      'branch::src/a.ts'
    ])
  })

  it('drops a genuinely duplicated row', () => {
    expect(buildChangedFileOrder([status('src/a.ts'), status('src/a.ts')], [])).toEqual([
      'unstaged::src/a.ts'
    ])
  })

  it('is empty when nothing changed', () => {
    expect(buildChangedFileOrder([], [])).toEqual([])
  })
})

describe('parseChangedFileRowKey', () => {
  it('splits a row key into its area and path', () => {
    expect(parseChangedFileRowKey('branch::src/a.ts')).toEqual({
      area: 'branch',
      relativePath: 'src/a.ts'
    })
    expect(parseChangedFileRowKey('unstaged::src/a.ts')).toEqual({
      area: 'working-tree',
      relativePath: 'src/a.ts'
    })
  })

  it('keeps separators that appear inside the path', () => {
    expect(parseChangedFileRowKey('branch::src/a::b.ts')).toEqual({
      area: 'branch',
      relativePath: 'src/a::b.ts'
    })
  })

  it('rejects a malformed key', () => {
    expect(parseChangedFileRowKey('no-separator')).toBeNull()
    expect(parseChangedFileRowKey('branch::')).toBeNull()
  })
})

describe('stepChangedFile', () => {
  const order = ['unstaged::a.ts', 'branch::a.ts', 'branch::b.ts']

  it('steps forward and back', () => {
    expect(stepChangedFile(order, 'unstaged::a.ts', 'next')).toBe('branch::a.ts')
    expect(stepChangedFile(order, 'branch::a.ts', 'previous')).toBe('unstaged::a.ts')
  })

  it('wraps at both ends so holding the shortcut cycles instead of stalling', () => {
    expect(stepChangedFile(order, 'branch::b.ts', 'next')).toBe('unstaged::a.ts')
    expect(stepChangedFile(order, 'unstaged::a.ts', 'previous')).toBe('branch::b.ts')
  })

  it('stops at both ends when wrapping is off, as a held shortcut asks', () => {
    expect(stepChangedFile(order, 'branch::b.ts', 'next', { wrap: false })).toBeNull()
    expect(stepChangedFile(order, 'unstaged::a.ts', 'previous', { wrap: false })).toBeNull()
    expect(stepChangedFile(order, 'branch::a.ts', 'next', { wrap: false })).toBe('branch::b.ts')
  })

  it('enters the list from the matching end when the open tab is not a changed file', () => {
    expect(stepChangedFile(order, 'edit::elsewhere.ts', 'next')).toBe('unstaged::a.ts')
    expect(stepChangedFile(order, null, 'previous')).toBe('branch::b.ts')
  })

  it('returns null when there is nowhere to go', () => {
    expect(stepChangedFile([], null, 'next')).toBeNull()
    // Why: a lone row would otherwise "step" onto itself and reload the same diff.
    expect(stepChangedFile(['branch::only.ts'], 'branch::only.ts', 'next')).toBeNull()
  })
})

describe('resolveCurrentRowKey', () => {
  const order = ['unstaged::a.ts', 'branch::a.ts', 'branch::b.ts']

  it('matches the row for the open diff, not merely one with the same path', () => {
    expect(resolveCurrentRowKey(order, 'branch', 'a.ts')).toBe('branch::a.ts')
    expect(resolveCurrentRowKey(order, 'unstaged', 'a.ts')).toBe('unstaged::a.ts')
  })

  it('falls back to the first row carrying the path for a plain edit tab', () => {
    // Why: an edit tab has no row of its own, and jumping the reviewer to the top of the list
    // would lose their place.
    expect(resolveCurrentRowKey(order, undefined, 'a.ts')).toBe('unstaged::a.ts')
    expect(resolveCurrentRowKey(order, 'edit', 'b.ts')).toBe('branch::b.ts')
  })

  it('returns null when the tab is not a file or its path is in no row', () => {
    expect(resolveCurrentRowKey(order, 'branch', null)).toBeNull()
    expect(resolveCurrentRowKey(order, 'branch', 'absent.ts')).toBeNull()
  })
})
