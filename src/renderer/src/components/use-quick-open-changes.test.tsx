// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { clearChangesFilter, setChangesFilter } from '@/lib/changes-filter'
import type { GitStatusEntry } from '../../../shared/git-status-types'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../shared/git-diff-compare-types'
import { useQuickOpenChanges } from './use-quick-open-changes'

const WT = 'wt-quick-open'

afterEach(() => {
  clearChangesFilter(WT)
  useAppStore.setState(useAppStore.getInitialState(), true)
})

describe('useQuickOpenChanges', () => {
  it("follows Source Control's active filter, updating when it changes", () => {
    useAppStore.setState({
      gitStatusByWorktree: {
        [WT]: [
          { path: 'src/a.ts', status: 'modified', area: 'unstaged', added: 10, removed: 10 }
        ] as GitStatusEntry[]
      },
      gitBranchChangesByWorktree: {
        [WT]: [{ path: 'src/a.ts', status: 'modified' } as GitBranchChangeEntry]
      },
      gitBranchCompareSummaryByWorktree: {
        [WT]: { status: 'ready', mergeBase: 'base' } as GitBranchCompareSummary
      },
      gitBranchLineTotalByWorktree: {
        [WT]: { mergeBase: 'base', files: { 'src/a.ts': { added: 20, removed: 20 } } }
      } as never
    })
    const { result } = renderHook(() => useQuickOpenChanges(WT))
    expect(result.current.get('src/a.ts')).toMatchObject({ added: 20, removed: 20 })

    act(() => setChangesFilter(WT, { kind: 'uncommitted' }))
    expect(result.current.get('src/a.ts')).toMatchObject({ added: 10, removed: 10 })
  })
})
