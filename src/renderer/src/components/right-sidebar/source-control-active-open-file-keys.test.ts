import { describe, expect, it } from 'vitest'
import {
  buildActiveOpenFileSignature,
  buildActiveOpenRowKeys
} from './source-control/listing/active-open-file-keys'

describe('buildActiveOpenFileSignature', () => {
  it('encodes the diff source and relative path', () => {
    expect(buildActiveOpenFileSignature('staged', 'src/file.ts')).toBe('staged::src/file.ts')
    expect(buildActiveOpenFileSignature('unstaged', 'src/file.ts')).toBe('unstaged::src/file.ts')
  })

  it('falls back to the edit source when the tab has no diff source', () => {
    expect(buildActiveOpenFileSignature(undefined, 'docs/readme.md')).toBe('edit::docs/readme.md')
  })

  it('keeps separators that appear inside the path intact', () => {
    const signature = buildActiveOpenFileSignature('unstaged', 'src/a::b.ts')
    expect(buildActiveOpenRowKeys(signature)).toEqual(
      new Set(['unstaged::src/a::b.ts', 'untracked::src/a::b.ts'])
    )
  })
})

describe('buildActiveOpenRowKeys', () => {
  it('matches only the staged row for a staged diff', () => {
    expect(buildActiveOpenRowKeys('staged::src/file.ts')).toEqual(new Set(['staged::src/file.ts']))
  })

  it('matches the working-tree rows for an unstaged diff', () => {
    expect(buildActiveOpenRowKeys('unstaged::src/file.ts')).toEqual(
      new Set(['unstaged::src/file.ts', 'untracked::src/file.ts'])
    )
  })

  it('treats an untracked file opened as an unstaged diff like the working tree', () => {
    expect(buildActiveOpenRowKeys('unstaged::docs/readme.md')).toEqual(
      new Set(['unstaged::docs/readme.md', 'untracked::docs/readme.md'])
    )
  })

  it('matches edit tabs to working-tree rows before staged-only fallback', () => {
    expect(buildActiveOpenRowKeys('edit::docs/readme.md')).toEqual(
      new Set(['unstaged::docs/readme.md', 'untracked::docs/readme.md'])
    )
    expect(
      buildActiveOpenRowKeys(
        'edit::docs/readme.md',
        new Set(['staged::docs/readme.md', 'unstaged::docs/readme.md'])
      )
    ).toEqual(new Set(['unstaged::docs/readme.md']))
    expect(
      buildActiveOpenRowKeys('edit::docs/readme.md', new Set(['staged::docs/readme.md']))
    ).toEqual(new Set(['staged::docs/readme.md']))
  })

  it('matches a branch diff tab to its branch row, never to a pending row', () => {
    const keys = buildActiveOpenRowKeys('branch::src/file.ts')
    expect(keys).toEqual(new Set(['branch::src/file.ts']))
    // Why: the working-tree rows for the same path must stay unhighlighted — a committed diff is
    // not the pending change, and highlighting both would claim the user is looking at two rows.
    expect(keys.has('unstaged::src/file.ts')).toBe(false)
    expect(keys.has('untracked::src/file.ts')).toBe(false)
    expect(keys.has('staged::src/file.ts')).toBe(false)
  })

  it('keeps a branch row key even when the working-tree selection does not list it', () => {
    // Why: availableRowKeys is the uncommitted selection, so filtering branch keys through it would
    // drop every one of them and leave committed files unhighlightable.
    expect(buildActiveOpenRowKeys('branch::src/file.ts', new Set(['unstaged::other.ts']))).toEqual(
      new Set(['branch::src/file.ts'])
    )
  })

  it('does not match commit or combined diff tabs to pending rows', () => {
    expect(buildActiveOpenRowKeys('commit::src/file.ts').size).toBe(0)
    expect(buildActiveOpenRowKeys('combined-uncommitted::src/file.ts').size).toBe(0)
    expect(buildActiveOpenRowKeys('combined-branch::src/file.ts').size).toBe(0)
    expect(buildActiveOpenRowKeys('combined-commit::src/file.ts').size).toBe(0)
  })

  it('returns an empty set when there is no active open file', () => {
    expect(buildActiveOpenRowKeys(null).size).toBe(0)
  })

  it('returns an empty set for a malformed signature', () => {
    expect(buildActiveOpenRowKeys('no-separator').size).toBe(0)
    expect(buildActiveOpenRowKeys('staged::').size).toBe(0)
  })
})
