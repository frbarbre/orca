import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows.test-fixture'
import { repoMap, worktree } from '../../worktree-list-groups-test-fixtures'
import { getGroupKeyForWorktree } from '../../../../../../shared/sidebar-list/worktree-group-keys'
import { cloneDefaultWorkspaceStatuses } from '../../../../../../shared/workspace-statuses'
import { getSidebarHeaderVisual } from '../rows/header-visuals'
import { createSidebarStackReader } from './stack-key'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { planSidebarRows } from '../../../../../../shared/sidebar-list/sidebar-row-plan'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host'

function branchWorktree(id: string, branch: string): Worktree {
  return { ...worktree, id, path: `/tmp/${id}`, branch: `refs/heads/${branch}`, displayName: id }
}

function stackedPR(stack: number, position: number) {
  return { data: { number: stack + position, state: 'open', stack: { number: stack, position } } }
}

const bottom = branchWorktree('bottom', 'stack/a')
const middle = branchWorktree('middle', 'stack/b')
const top = branchWorktree('top', 'stack/c')
const other = branchWorktree('other', 'other/a')
const loose = branchWorktree('loose', 'loose')

const prCache = {
  'repo-1::stack/a': stackedPR(7, 1),
  'repo-1::stack/b': stackedPR(7, 2),
  'repo-1::stack/c': stackedPR(7, 3),
  'repo-1::other/a': stackedPR(9, 1),
  'repo-1::loose': { data: { number: 50, state: 'open' } }
}

const summary = (rows: ReturnType<typeof buildRows>) =>
  rows.map((row) =>
    row.type === 'header' ? `# ${row.key} ${row.count}` : row.type === 'item' ? row.worktree.id : ''
  )

describe('groupBy stack', () => {
  it('lists each stack furthest from main first, then the worktrees outside a stack', () => {
    const rows = buildRows(
      'stack',
      [loose, bottom, top, other, middle],
      repoMap,
      prCache,
      new Set()
    )

    expect(summary(rows)).toEqual([
      '# stack:repo-1:9 1',
      'other',
      '# stack:repo-1:7 3',
      'top',
      'middle',
      'bottom',
      '# stack:none 1',
      'loose'
    ])
    expect(rows[0]).toMatchObject({ type: 'header', icon: { kind: 'stack', stack: 9 } })
    expect(rows[6]).toMatchObject({ type: 'header', icon: { kind: 'stack', stack: null } })
  })

  it('puts every worktree outside a stack while PR data is missing', () => {
    expect(summary(buildRows('stack', [bottom, loose], repoMap, null, new Set()))).toEqual([
      '# stack:none 2',
      'bottom',
      'loose'
    ])
  })

  it('reveals a worktree under its stack header', () => {
    expect(
      getGroupKeyForWorktree(
        'stack',
        middle,
        repoMap,
        null,
        cloneDefaultWorkspaceStatuses(),
        undefined,
        createSidebarStackReader(repoMap, prCache)
      )
    ).toBe('stack:repo-1:7')
  })

  it('gives worktrees in the reviewing status their own section first, even inside a stack', () => {
    const reviewing = (w: Worktree) => ({ ...w, workspaceStatus: 'in-review' })
    const worktrees = [loose, bottom, reviewing(top), reviewing(other), middle]
    const rows = planSidebarRows({
      groupBy: 'stack',
      worktrees,
      repoMap,
      prGroupOf: () => 'in-progress',
      stackOf: createSidebarStackReader(repoMap, prCache, 'in-review'),
      workspaceStatuses: cloneDefaultWorkspaceStatuses(),
      projectOrderBy: 'manual',
      lineageById: {},
      worktreeMap: new Map(worktrees.map((w) => [w.id, w])),
      nestLineage: false,
      projectGroups: [],
      placeholderRepoIds: new Set(),
      importedWorktreesByRepo: new Map(),
      newExternalWorktreesInboxByRepo: new Map(),
      pendingCreations: [],
      folderWorkspaces: [],
      defaultHostId: LOCAL_EXECUTION_HOST_ID,
      pinnedDisplayPolicy: 'single-location',
      filterRepoIds: []
    }).render(new Set())

    expect(summary(rows)).toEqual([
      '# stack:reviewing 2',
      'top',
      'other',
      '# stack:repo-1:7 2',
      'middle',
      'bottom',
      '# stack:none 1',
      'loose'
    ])
    expect(rows[0]).toMatchObject({ type: 'header', icon: { kind: 'stack', stack: 'reviewing' } })
  })

  it('names stack headers by their stack number', () => {
    const statuses = cloneDefaultWorkspaceStatuses()
    expect(getSidebarHeaderVisual({ kind: 'stack', stack: 7 }, statuses).label).toBe('Stack #7')
    expect(getSidebarHeaderVisual({ kind: 'stack', stack: null }, statuses).label).toBe(
      'Not in a stack'
    )
    expect(getSidebarHeaderVisual({ kind: 'stack', stack: 'reviewing' }, statuses).label).toBe(
      'Reviewing'
    )
  })
})
