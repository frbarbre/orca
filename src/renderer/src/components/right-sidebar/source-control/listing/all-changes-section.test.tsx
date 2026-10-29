// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SourceControlAllChangesSection } from './all-changes-section'

const entries: GitBranchChangeEntry[] = [
  { path: 'src/committed.ts', status: 'modified', added: 3, removed: 1 },
  { path: 'src/untracked.ts', status: 'added', added: 4 }
]

function renderSection(overrides: Partial<Parameters<typeof SourceControlAllChangesSection>[0]>) {
  const props: Parameters<typeof SourceControlAllChangesSection>[0] = {
    baseRef: 'refs/remotes/origin/main',
    entries,
    totalEntryCount: entries.length,
    collapsed: false,
    onToggle: vi.fn(),
    sourceControlViewMode: 'list',
    visibleTreeRows: [],
    fileListScrollElement: null,
    collapsedTreeDirs: new Set(),
    toggleTreeDir: vi.fn(),
    currentWorktreeId: 'wt',
    worktreePath: '/repo',
    revealInExplorer: vi.fn(),
    activeConnectionId: null,
    onOpen: vi.fn(),
    diffCommentCountByPath: new Map(),
    reviewThreadCountByPath: new Map(),
    pendingReviewCountByPath: new Map(),
    activeOpenRowKeys: new Set(),
    activeOpenRowKey: null,
    ...overrides
  }
  render(
    <TooltipProvider>
      <SourceControlAllChangesSection {...props} />
    </TooltipProvider>
  )
  return props
}

afterEach(cleanup)

describe('SourceControlAllChangesSection', () => {
  it('lists every changed file under one heading counted against the base', () => {
    renderSection({})
    expect(screen.getByText('Changes')).toBeTruthy()
    expect(screen.getByTitle('2 files changed vs origin/main')).toBeTruthy()
    expect(screen.getByText('committed.ts')).toBeTruthy()
    expect(screen.getByText('untracked.ts')).toBeTruthy()
  })

  it('opens the clicked file and marks the open one', () => {
    const props = renderSection({
      activeOpenRowKeys: new Set(['branch-worktree::src/untracked.ts'])
    })
    fireEvent.click(screen.getByText('committed.ts'))
    expect(props.onOpen).toHaveBeenCalledWith(entries[0], expect.anything())
    expect(screen.getByText('untracked.ts').closest('[data-current="true"]')).toBeTruthy()
    expect(screen.getByText('committed.ts').closest('[data-current="true"]')).toBeNull()
  })

  it('keeps extra header actions, like the file type filter', () => {
    renderSection({ headerActions: <button type="button">Filter</button> })
    expect(screen.getByText('Filter')).toBeTruthy()
  })

  it('names the active filter in a removable badge, like Latest turn', () => {
    const props = renderSection({
      filterBadge: { label: 'Latest turn', title: 'Do the thing' },
      onClearFilter: vi.fn()
    })
    expect(screen.getByText('Latest turn')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all changes' }))
    expect(props.onClearFilter).toHaveBeenCalled()
    expect(props.onToggle).not.toHaveBeenCalled()
  })

  it('totals the lines of the files it lists, so a filter narrows the total too', () => {
    renderSection({})
    expect(screen.getByTestId('source-control-changes-line-total').textContent).toBe('+7-1')
    cleanup()
    renderSection({ entries: [entries[0]], filterBadge: { label: 'Latest turn' } })
    expect(screen.getByTestId('source-control-changes-line-total').textContent).toBe('+3-1')
  })

  it('shows no line total when the listed files changed no lines', () => {
    renderSection({ entries: [{ path: 'logo.png', status: 'added' }] })
    expect(screen.queryByTestId('source-control-changes-line-total')).toBeNull()
  })

  it("discards a file's uncommitted change from its row, and offers nothing on a committed one", () => {
    const untracked: GitStatusEntry = {
      path: 'src/untracked.ts',
      status: 'untracked',
      area: 'untracked'
    }
    const props = renderSection({
      discardableByPath: new Map([['src/untracked.ts', untracked]]),
      onDiscard: vi.fn()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete untracked file' }))

    expect(props.onDiscard).toHaveBeenCalledWith(untracked)
    expect(props.onOpen).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: /Discard|Delete|Restore/ })).toHaveLength(1)
  })

  it('shows no badge, and no View all, while every change is listed', () => {
    renderSection({})
    expect(screen.queryByRole('button', { name: 'Show all changes' })).toBeNull()
    expect(screen.queryByText('View all')).toBeNull()
  })
})
