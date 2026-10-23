// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { Command } from '@/components/ui/command'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../shared/git-diff-compare-types'
import { openQuickOpenChange, resolveQuickOpenTarget } from './quick-open-change'
import { QuickOpenTextItems } from './QuickOpenModeItems'
import { ChangeEntryStat } from './right-sidebar/source-control/listing/change-entry-stat'

vi.mock('@/lib/file-type-icons', () => ({ getFileTypeIcon: () => () => null }))

afterEach(cleanup)

const change: GitBranchChangeEntry = { path: 'src/a.ts', status: 'modified', added: 23, removed: 1 }
const changes = new Map([[change.path, change]])

describe('resolveQuickOpenTarget', () => {
  it('opens the diff of a file that has changes in the current scope', () => {
    expect(resolveQuickOpenTarget('src/a.ts', { pathQuery: 'a' }, changes)).toEqual({
      kind: 'diff',
      entry: change
    })
  })

  it('opens the file itself when it has no changes in scope', () => {
    expect(resolveQuickOpenTarget('src/b.ts', { pathQuery: 'b', line: 3 }, changes)).toEqual({
      kind: 'file'
    })
  })

  it('opens the diff at the line a text match names', () => {
    expect(
      resolveQuickOpenTarget('src/a.ts', { pathQuery: 'a', line: 12, column: 4 }, changes)
    ).toEqual({ kind: 'diff', entry: change, line: 12, column: 4 })
  })
})

describe('openQuickOpenChange', () => {
  afterEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('opens the branch diff with a reveal armed at the match', () => {
    const openBranchWorktreeDiff = vi.fn()
    const summary = { status: 'ready', mergeBase: 'base' } as GitBranchCompareSummary
    useAppStore.setState({
      openBranchWorktreeDiff,
      gitBranchCompareSummaryByWorktree: { wt: summary }
    })

    openQuickOpenChange('wt', '/repo', { kind: 'diff', entry: change, line: 12, column: 4 }, 7)

    expect(useAppStore.getState().pendingEditorReveal).toMatchObject({
      filePath: '/repo/src/a.ts',
      line: 12,
      column: 4,
      matchLength: 7
    })
    expect(openBranchWorktreeDiff).toHaveBeenCalledWith(
      'wt',
      '/repo',
      change,
      summary,
      expect.any(String),
      expect.anything()
    )
  })

  it('opens the diff at the top when no line is named', () => {
    useAppStore.setState({
      openBranchWorktreeDiff: vi.fn(),
      gitBranchCompareSummaryByWorktree: {
        wt: { status: 'ready', mergeBase: 'base' } as GitBranchCompareSummary
      }
    })

    openQuickOpenChange('wt', '/repo', { kind: 'diff', entry: change })

    expect(useAppStore.getState().pendingEditorReveal).toBeNull()
  })
})

describe('QuickOpenTextItems', () => {
  it("shows a changed file's counts beside its match count", () => {
    render(
      <Command>
        <QuickOpenTextItems
          rows={[
            {
              kind: 'file',
              key: 'file:src/a.ts',
              filePath: '/repo/src/a.ts',
              relativePath: 'src/a.ts',
              matchCount: 5
            }
          ]}
          changesByPath={changes}
          disabled={false}
          onSelect={() => {}}
        />
      </Command>
    )
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('+23')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})

describe('ChangeEntryStat', () => {
  it("shows a change's line counts and status the way Source Control's row does", () => {
    render(<ChangeEntryStat entry={change} />)
    expect(screen.getByText('+23')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})
