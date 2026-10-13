import { describe, expect, it } from 'vitest'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import {
  changesFilterKey,
  findFollowEntry,
  pickUncommittedRowEntry
} from './open-diff-follows-filter'

const compare = { commitOid: 'c2', parentOid: 'c1', compareRef: 'c2', baseRef: 'c1' }
const turn = (commitOid: string) =>
  ({
    kind: 'turn',
    compare: { ...compare, commitOid },
    entries: [],
    prompt: 'Fix it',
    latest: true
  }) as const

describe('changesFilterKey', () => {
  it('tells every filter apart, a newer latest turn included', () => {
    const keys = [
      changesFilterKey(null),
      changesFilterKey({ kind: 'uncommitted' }),
      changesFilterKey(turn('c2')),
      changesFilterKey(turn('c3'))
    ]
    expect(new Set(keys).size).toBe(4)
    expect(changesFilterKey(turn('c2'))).toBe(changesFilterKey(turn('c2')))
  })
})

describe('findFollowEntry', () => {
  const entries = [{ path: 'src/app.ts', status: 'modified' as const }]
  const file = {
    mode: 'diff' as const,
    isDirty: false,
    worktreeId: 'wt',
    relativePath: 'src/app.ts'
  }

  it('follows the open diff of a file the new list still has', () => {
    expect(findFollowEntry(file, 'wt', entries)).toEqual(entries[0])
  })

  it('leaves a tab with unsaved edits, a non-diff tab, another workspace or an unlisted file', () => {
    expect(findFollowEntry({ ...file, isDirty: true }, 'wt', entries)).toBeNull()
    expect(findFollowEntry({ ...file, mode: 'edit' }, 'wt', entries)).toBeNull()
    expect(findFollowEntry(file, 'other', entries)).toBeNull()
    expect(findFollowEntry({ ...file, relativePath: 'src/gone.ts' }, 'wt', entries)).toBeNull()
    expect(findFollowEntry(undefined, 'wt', entries)).toBeNull()
  })
})

describe('pickUncommittedRowEntry', () => {
  const entry = (area: GitStatusEntry['area']): GitStatusEntry =>
    ({ path: 'src/app.ts', area, status: 'modified' }) as GitStatusEntry

  it('opens the working-tree change before the staged one', () => {
    expect(pickUncommittedRowEntry([entry('staged'), entry('unstaged')])?.area).toBe('unstaged')
    expect(pickUncommittedRowEntry([entry('staged'), entry('untracked')])?.area).toBe('untracked')
    expect(pickUncommittedRowEntry([entry('staged')])?.area).toBe('staged')
    expect(pickUncommittedRowEntry([])).toBeUndefined()
  })
})
