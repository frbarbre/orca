import { describe, expect, it } from 'vitest'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import { buildScopedChangeEntries } from './scoped-change-entries'

const uncommitted: GitStatusEntry = {
  path: 'src/a.ts',
  status: 'modified',
  area: 'unstaged',
  added: 10,
  removed: 10
} as GitStatusEntry
const committed: GitBranchChangeEntry = {
  path: 'src/a.ts',
  status: 'modified',
  added: 20,
  removed: 20
}

describe('buildScopedChangeEntries', () => {
  it('counts the uncommitted change while the Uncommitted filter is on', () => {
    expect(
      buildScopedChangeEntries({
        statusEntries: [uncommitted],
        branchEntries: [committed],
        changesFilter: { kind: 'uncommitted' },
        lineCounts: { 'src/a.ts': { added: 20, removed: 20 } },
        hiddenCategories: new Set(),
        reviewAttributes: {}
      })
    ).toEqual([{ path: 'src/a.ts', status: 'modified', added: 10, removed: 10 }])
  })

  it('counts the file against the branch base with no filter on', () => {
    expect(
      buildScopedChangeEntries({
        statusEntries: [uncommitted],
        branchEntries: [committed],
        changesFilter: null,
        lineCounts: { 'src/a.ts': { added: 20, removed: 20 } },
        hiddenCategories: new Set(),
        reviewAttributes: {}
      })
    ).toEqual([{ path: 'src/a.ts', status: 'modified', added: 20, removed: 20 }])
  })

  it("lists a turn's own files under a turn filter", () => {
    const turnEntry: GitBranchChangeEntry = { path: 'src/b.ts', status: 'added', added: 3 }
    expect(
      buildScopedChangeEntries({
        statusEntries: [uncommitted],
        branchEntries: [committed],
        changesFilter: {
          kind: 'turn',
          compare: { commitOid: 'c', parentOid: 'p', compareRef: 'c', baseRef: 'p' },
          entries: [turnEntry],
          prompt: 'do it',
          latest: true
        },
        hiddenCategories: new Set(),
        reviewAttributes: {}
      })
    ).toEqual([turnEntry])
  })

  it('leaves out the file categories Source Control hides', () => {
    const testFile = { ...uncommitted, path: 'src/a.test.ts' }
    expect(
      buildScopedChangeEntries({
        statusEntries: [uncommitted, testFile],
        branchEntries: [],
        changesFilter: null,
        hiddenCategories: new Set(['test']),
        reviewAttributes: {}
      }).map((entry) => entry.path)
    ).toEqual(['src/a.ts'])
  })
})
