import { describe, expect, it } from 'vitest'
import { createEditorStore } from './editor-slice-test-harness'

function compare(baseRef: string, baseOid: string) {
  return {
    baseRef,
    baseOid,
    compareRef: 'feature',
    headOid: 'head-1',
    mergeBase: baseOid,
    changedFiles: 1,
    commitsAhead: 1,
    status: 'ready' as const
  }
}

const entry = { path: 'src/a.ts', status: 'modified' as const }

describe('branch diff follows a new diff base', () => {
  it('reloads the open branch diff against the new base and reuses its tab', () => {
    const store = createEditorStore()
    store
      .getState()
      .openBranchDiff('wt-1', '/repo', entry, compare('refs/remotes/origin/main', 'main-oid'), 'ts')
    const [opened] = store.getState().openFiles

    const next = compare('abc123^', 'commit-oid')
    store.getState().beginGitBranchCompareRequest('wt-1', 'req-2', next.baseRef)
    store.getState().setGitBranchCompareResult('wt-1', 'req-2', { summary: next, entries: [entry] })

    const [retargeted] = store.getState().openFiles
    expect(retargeted?.id).toBe(opened?.id)
    expect(retargeted?.branchCompare?.baseOid).toBe('commit-oid')
    expect(retargeted?.diffContentReloadNonce).toBe((opened?.diffContentReloadNonce ?? 0) + 1)

    store.getState().openBranchDiff('wt-1', '/repo', entry, next, 'ts')
    expect(store.getState().openFiles).toHaveLength(1)
  })
})
