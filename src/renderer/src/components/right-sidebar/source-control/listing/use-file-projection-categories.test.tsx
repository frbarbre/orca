// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'
import type { SourceControlFileCategory } from './file-category'
import { useSourceControlFileProjection } from './use-file-projection'

const ENTRIES: GitStatusEntry[] = [
  { path: 'src/app.ts', area: 'staged', status: 'modified' },
  { path: 'src/app.test.ts', area: 'unstaged', status: 'modified' },
  { path: 'pnpm-lock.yaml', area: 'unstaged', status: 'modified' },
  { path: 'e2e/login.ts', area: 'untracked', status: 'untracked' }
]
const BRANCH_ENTRIES: GitBranchChangeEntry[] = [
  { path: 'src/api.ts', status: 'modified' },
  { path: 'apps/api/types/_generated/user.py', status: 'added' },
  { path: 'tests/api.spec.ts', status: 'modified' }
]

function project(
  hiddenFileCategories: SourceControlFileCategory[],
  reviewAttributes: GitPathReviewAttributes = {}
) {
  return renderHook(() =>
    useSourceControlFileProjection({
      entries: ENTRIES,
      branchEntries: BRANCH_ENTRIES,
      filterQuery: '',
      hiddenFileCategories: new Set(hiddenFileCategories),
      reviewAttributes,
      sourceControlGroupOrder: ['staged', 'unstaged', 'untracked'],
      activeWorktreeId: 'wt-1',
      worktreePath: '/repo',
      isFolder: false,
      collapsedTreeDirs: new Set(),
      expandedSubmoduleKeys: new Set(),
      submoduleStatusByKey: {},
      sourceControlViewMode: 'list',
      collapsedSections: new Set()
    })
  ).result.current
}

const paths = (entries: readonly { path: string }[]) => entries.map((entry) => entry.path)

describe('useSourceControlFileProjection file categories', () => {
  it('lists the categories present across uncommitted and committed changes', () => {
    expect(project([]).presentFileCategories).toEqual(['implementation', 'test', 'generated'])
  })

  it('hides a category from every uncommitted area and from the branch section', () => {
    const projection = project(['test'])

    expect(projection.isCategoryFilterActive).toBe(true)
    expect(paths(projection.filteredGrouped.staged)).toEqual(['src/app.ts'])
    expect(paths(projection.filteredGrouped.unstaged)).toEqual(['pnpm-lock.yaml'])
    expect(projection.filteredGrouped.untracked).toEqual([])
    expect(paths(projection.filteredBranchEntries)).toEqual([
      'apps/api/types/_generated/user.py',
      'src/api.ts'
    ])
  })

  it('keeps hidden files out of the section bulk actions', () => {
    const projection = project(['generated'])
    expect(paths(projection.unfilteredDisplaySectionsById.get('unstaged')?.items ?? [])).toEqual([
      'src/app.test.ts'
    ])
  })

  it('classifies with .gitattributes', () => {
    const projection = project(['generated'], {
      'apps/api/types/_generated/user.py': { 'linguist-generated': 'set' },
      'pnpm-lock.yaml': { 'linguist-generated': 'unset' }
    })
    expect(paths(projection.filteredBranchEntries)).toEqual(['src/api.ts', 'tests/api.spec.ts'])
    expect(paths(projection.filteredGrouped.unstaged)).toEqual([
      'pnpm-lock.yaml',
      'src/app.test.ts'
    ])
  })

  it('treats a hidden category absent from the diff as no filter', () => {
    expect(project(['documentation']).isCategoryFilterActive).toBe(false)
  })
})
