import { afterEach, describe, expect, it } from 'vitest'
import { createEditorStore } from './editor-slice-test-harness'
import { clearChangesFilter, setChangesFilter } from '@/lib/changes-filter'

const START = 's'.repeat(40)
const END = 'e'.repeat(40)

function turnFilter(latest: boolean) {
  return {
    kind: 'turn' as const,
    compare: { commitOid: END, parentOid: START, compareRef: 'eeeeeee', baseRef: 'sssssss' },
    entries: [{ path: 'src/a.ts', status: 'modified' as const }],
    prompt: 'Do the thing',
    latest
  }
}

function stepOnto(store: ReturnType<typeof createEditorStore>): void {
  store.getState().openDiffAtLocation({
    worktreeId: 'wt-1',
    worktreePath: '/repo',
    relativePath: 'src/a.ts',
    area: 'branch-worktree'
  })
}

afterEach(() => clearChangesFilter('wt-1'))

describe('opening a Changes row under a turn or commit filter', () => {
  it('shows the latest turn as what it changed, not what the agent is changing now', () => {
    const store = createEditorStore()
    setChangesFilter('wt-1', turnFilter(true))
    stepOnto(store)
    expect(store.getState().openFiles[0]).toMatchObject({
      diffSource: 'commit',
      commitCompare: { commitOid: END, parentOid: START }
    })
  })

  it('shows an older turn as what it changed, frozen', () => {
    const store = createEditorStore()
    setChangesFilter('wt-1', turnFilter(false))
    stepOnto(store)
    expect(store.getState().openFiles[0]).toMatchObject({
      diffSource: 'commit',
      commitCompare: { commitOid: END, parentOid: START }
    })
  })

  it("shows a commit's file as that commit changed it", () => {
    const store = createEditorStore()
    setChangesFilter('wt-1', {
      kind: 'commit',
      compare: { commitOid: END, parentOid: START, compareRef: 'eeeeeee', baseRef: 'sssssss' },
      entries: [{ path: 'src/a.ts', status: 'modified' }],
      subject: 'Fix it'
    })
    stepOnto(store)
    expect(store.getState().openFiles[0]).toMatchObject({
      diffSource: 'commit',
      commitCompare: { commitOid: END, subject: 'Fix it' }
    })
  })
})
