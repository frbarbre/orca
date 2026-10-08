import { describe, expect, it } from 'vitest'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { OpenFile } from '../types/open-file'
import { toBranchCompareSnapshot } from './git-status-reconciliation'
import { retargetBranchDiffFiles } from './retarget-branch-diff-files'

function summary(baseRef: string, baseOid: string): GitBranchCompareSummary {
  return {
    baseRef,
    baseOid,
    compareRef: 'HEAD',
    headOid: 'head-1',
    mergeBase: baseOid,
    changedFiles: 2,
    status: 'ready'
  }
}

const oldCompare = toBranchCompareSnapshot(summary('origin/main', 'base-main'))

function branchDiff(id: string, relativePath: string, overrides: Partial<OpenFile> = {}): OpenFile {
  return {
    id,
    filePath: `/repo/${relativePath}`,
    relativePath,
    worktreeId: 'wt-1',
    language: 'typescript',
    isDirty: false,
    mode: 'diff',
    diffSource: 'branch',
    branchCompare: oldCompare,
    ...overrides
  }
}

const entries: GitBranchChangeEntry[] = [
  { path: 'src/a.ts', status: 'modified' },
  { path: 'src/b.ts', status: 'added' }
]

describe('retargetBranchDiffFiles', () => {
  it('points an open branch diff at the new base and asks it to reload, keeping its tab', () => {
    const files = [branchDiff('tab-a', 'src/a.ts')]
    const next = retargetBranchDiffFiles(files, 'wt-1', summary('abc123^', 'base-commit'), entries)

    expect(next[0]?.id).toBe('tab-a')
    expect(next[0]?.branchCompare?.baseRef).toBe('abc123^')
    expect(next[0]?.branchCompare?.baseOid).toBe('base-commit')
    expect(next[0]?.diffContentReloadNonce).toBe(1)
  })

  it('retargets a combined branch diff too', () => {
    const files = [branchDiff('combined', '', { diffSource: 'combined-branch' })]
    const next = retargetBranchDiffFiles(files, 'wt-1', summary('abc123^', 'base-commit'), entries)
    expect(next[0]?.branchCompare?.baseOid).toBe('base-commit')
  })

  it('leaves a diff whose file is not changed against the new base, other worktrees and other diffs', () => {
    const files = [
      branchDiff('gone', 'src/c.ts'),
      branchDiff('other-wt', 'src/a.ts', { worktreeId: 'wt-2' }),
      branchDiff('unstaged', 'src/a.ts', { diffSource: 'unstaged', branchCompare: undefined })
    ]
    const next = retargetBranchDiffFiles(files, 'wt-1', summary('abc123^', 'base-commit'), entries)
    expect(next).toBe(files)
  })

  it('does nothing while the new compare is still loading or already matches', () => {
    const files = [branchDiff('tab-a', 'src/a.ts')]
    expect(
      retargetBranchDiffFiles(files, 'wt-1', { ...summary('x', 'y'), status: 'loading' }, entries)
    ).toBe(files)
    expect(
      retargetBranchDiffFiles(files, 'wt-1', summary('origin/main', 'base-main'), entries)
    ).toBe(files)
  })
})
