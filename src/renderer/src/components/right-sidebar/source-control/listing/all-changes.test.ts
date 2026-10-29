import { describe, expect, it } from 'vitest'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import {
  buildAllChangeEntries,
  buildAllChangesOpenRowKeys,
  discardableEntriesByPath
} from './all-changes'
import { buildActiveOpenFileSignature } from './active-open-file-keys'

function status(entry: Partial<GitStatusEntry> & Pick<GitStatusEntry, 'path'>): GitStatusEntry {
  return { status: 'modified', area: 'unstaged', ...entry }
}

function branch(
  entry: Partial<GitBranchChangeEntry> & Pick<GitBranchChangeEntry, 'path'>
): GitBranchChangeEntry {
  return { status: 'modified', ...entry }
}

describe('discardableEntriesByPath', () => {
  it("finds each file's uncommitted change that discarding throws away", () => {
    const unstaged = status({ path: 'src/a.ts' })
    const untracked = status({ path: 'src/new.ts', status: 'untracked', area: 'untracked' })
    const alsoStaged = status({ path: 'src/b.ts', area: 'staged' })
    const unstagedOnTop = status({ path: 'src/b.ts' })

    expect(
      discardableEntriesByPath([
        unstaged,
        untracked,
        alsoStaged,
        unstagedOnTop,
        status({ path: 'src/only-staged.ts', area: 'staged' }),
        status({ path: 'src/conflict.ts', conflictStatus: 'unresolved' }),
        status({ path: 'vendor/lib', submoduleRoot: 'vendor/lib' })
      ])
    ).toEqual(
      new Map([
        ['src/a.ts', unstaged],
        ['src/new.ts', untracked],
        ['src/b.ts', unstagedOnTop]
      ])
    )
  })
})

describe('buildAllChangeEntries', () => {
  it('lists every changed file once, whether committed, staged, unstaged or untracked', () => {
    expect(
      buildAllChangeEntries(
        [
          status({ path: 'src/b.ts', area: 'staged' }),
          status({ path: 'src/b.ts', area: 'unstaged' }),
          status({ path: 'src/new.ts', status: 'untracked', area: 'untracked' }),
          status({ path: 'src/a.ts' })
        ],
        [branch({ path: 'src/a.ts' }), branch({ path: 'docs/readme.md' })]
      ).map((entry) => entry.path)
    ).toEqual(['docs/readme.md', 'src/a.ts', 'src/b.ts', 'src/new.ts'])
  })

  it('keeps only files with uncommitted changes when asked, reported as uncommitted changes', () => {
    const entries = buildAllChangeEntries(
      [
        status({ path: 'src/b.ts', area: 'staged' }),
        status({ path: 'src/new.ts', status: 'untracked', area: 'untracked', added: 9 }),
        status({ path: 'src/a.ts', added: 15, removed: 0 })
      ],
      [
        branch({ path: 'src/a.ts', status: 'added', added: 142, removed: 0 }),
        branch({ path: 'docs/readme.md' })
      ],
      { uncommittedOnly: true, lineCounts: { 'src/a.ts': { added: 142, removed: 0 } } }
    )
    expect(entries.map((entry) => [entry.path, entry.status, entry.added])).toEqual([
      ['src/a.ts', 'modified', 15],
      ['src/b.ts', 'modified', undefined],
      ['src/new.ts', 'added', 9]
    ])
  })

  it('reports each file as it stands against the branch base', () => {
    const entries = buildAllChangeEntries(
      [
        status({ path: 'added-then-edited.ts' }),
        status({ path: 'untracked.ts', status: 'untracked', area: 'untracked' }),
        status({ path: 'committed-then-deleted.ts', status: 'deleted' }),
        status({ path: 'added-then-deleted.ts', status: 'deleted' }),
        status({ path: 'moved.ts', status: 'renamed', area: 'staged', oldPath: 'old.ts' }),
        status({ path: 'renamed-on-branch.ts' })
      ],
      [
        branch({ path: 'added-then-edited.ts', status: 'added' }),
        branch({ path: 'committed-then-deleted.ts' }),
        branch({ path: 'added-then-deleted.ts', status: 'added' }),
        branch({ path: 'renamed-on-branch.ts', status: 'renamed', oldPath: 'before.ts' })
      ]
    )
    expect(entries).toEqual([
      { path: 'added-then-edited.ts', status: 'added' },
      { path: 'committed-then-deleted.ts', status: 'deleted' },
      { path: 'moved.ts', status: 'renamed', oldPath: 'old.ts' },
      { path: 'renamed-on-branch.ts', status: 'renamed', oldPath: 'before.ts' },
      { path: 'untracked.ts', status: 'added' }
    ])
  })

  it('counts lines only from a file with one source, since per-area counts overlap', () => {
    const entries = buildAllChangeEntries(
      [
        status({ path: 'both.ts', added: 2, removed: 1 }),
        status({ path: 'local.ts', added: 4, removed: 0 }),
        status({ path: 'two-areas.ts', area: 'staged', added: 1, removed: 0 }),
        status({ path: 'two-areas.ts', added: 1, removed: 1 })
      ],
      [
        branch({ path: 'both.ts', added: 10, removed: 3 }),
        branch({ path: 'committed.ts', added: 7, removed: 2 })
      ]
    )
    expect(
      Object.fromEntries(entries.map((entry) => [entry.path, [entry.added, entry.removed]]))
    ).toEqual({
      'both.ts': [undefined, undefined],
      'committed.ts': [7, 2],
      'local.ts': [4, 0],
      'two-areas.ts': [undefined, undefined]
    })
  })

  it("takes a file's exact count against the base when the host measured it", () => {
    const lineCounts = {
      'both.ts': { added: 11, removed: 3 },
      'two-areas.ts': { added: 2, removed: 1 }
    }
    const entries = buildAllChangeEntries(
      [
        status({ path: 'both.ts', added: 2, removed: 1 }),
        status({ path: 'two-areas.ts', area: 'staged', added: 1, removed: 0 }),
        status({ path: 'two-areas.ts', added: 1, removed: 1 })
      ],
      [branch({ path: 'both.ts', added: 10, removed: 3 })],
      { lineCounts }
    )
    expect(
      Object.fromEntries(entries.map((entry) => [entry.path, [entry.added, entry.removed]]))
    ).toEqual({ 'both.ts': [11, 3], 'two-areas.ts': [2, 1] })
  })

  it('counts only the uncommitted lines while uncommitted changes are shown', () => {
    const entries = buildAllChangeEntries(
      [status({ path: 'both.ts', added: 2, removed: 1 })],
      [branch({ path: 'both.ts', added: 10, removed: 3 })],
      { uncommittedOnly: true, lineCounts: { 'both.ts': { added: 11, removed: 3 } } }
    )
    expect(entries.map((entry) => [entry.added, entry.removed])).toEqual([[2, 1]])
  })

  it("highlights a file's one row whichever kind of tab has it open, a previewed commit's too", () => {
    for (const source of [
      undefined,
      'unstaged',
      'staged',
      'branch',
      'branch-worktree',
      'commit'
    ] as const) {
      expect([
        ...buildAllChangesOpenRowKeys(buildActiveOpenFileSignature(source, 'src/a.ts'))
      ]).toEqual(['branch-worktree::src/a.ts'])
    }
    expect(buildAllChangesOpenRowKeys(null).size).toBe(0)
  })

  it("leaves out files inside a submodule, which aren't the branch's own changes", () => {
    expect(buildAllChangeEntries([status({ path: 'lib/x.ts', submoduleRoot: 'lib' })], [])).toEqual(
      []
    )
  })
})
