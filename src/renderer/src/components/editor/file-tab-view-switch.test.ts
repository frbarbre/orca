import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearChangesFilter, setChangesFilter } from '@/lib/changes-filter'
import { showFileDiff, showFileEdit } from './file-tab-view-switch'

const fixture = vi.hoisted(() => {
  const calls: string[] = []
  const state = {
    openFiles: [] as Record<string, unknown>[],
    editorCursorLine: {} as Record<string, number>,
    gitStatusByWorktree: {} as Record<string, { path: string; area: string }[]>,
    gitBranchChangesByWorktree: {} as Record<string, { path: string }[]>,
    gitBranchCompareSummaryByWorktree: {} as Record<string, { status: string }>,
    pendingEditorReveal: null as unknown,
    getKnownWorktreeById: (id: string) => (id === 'wt' ? { path: '/repo' } : undefined),
    openDiffAtLocation: vi.fn((target: unknown) => {
      calls.push('openDiff')
      fixture.state.pendingEditorReveal = target
    }),
    openFile: vi.fn(() => calls.push('openFile')),
    closeFile: vi.fn((id: string) => {
      calls.push(`close:${id}`)
      fixture.state.pendingEditorReveal = null
    }),
    setPendingEditorReveal: vi.fn((reveal: unknown) => {
      fixture.state.pendingEditorReveal = reveal
    }),
    setMarkdownViewMode: vi.fn(),
    setEditorViewMode: vi.fn()
  }
  const save = vi.fn(async (_target: unknown) => {
    calls.push('save')
  })
  return { calls, state, save }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => fixture.state } }))
vi.mock('./editor-autosave', () => ({
  requestEditorFileSave: (target: unknown) => fixture.save(target)
}))

const frames: FrameRequestCallback[] = []
vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback))

const editTab = {
  id: '/repo/src/a.ts',
  filePath: '/repo/src/a.ts',
  relativePath: 'src/a.ts',
  worktreeId: 'wt',
  mode: 'edit',
  isDirty: false
}
const diffTab = {
  id: 'wt::diff::unstaged::src/a.ts',
  filePath: '/repo/src/a.ts',
  relativePath: 'src/a.ts',
  worktreeId: 'wt',
  runtimeEnvironmentId: null,
  mode: 'diff',
  diffSource: 'unstaged',
  isDirty: false
}

afterEach(() => {
  fixture.calls.length = 0
  frames.length = 0
  vi.clearAllMocks()
  Object.assign(fixture.state, {
    openFiles: [],
    editorCursorLine: {},
    gitStatusByWorktree: {},
    gitBranchChangesByWorktree: {},
    gitBranchCompareSummaryByWorktree: {},
    pendingEditorReveal: null
  })
  fixture.save.mockImplementation(async () => {
    fixture.calls.push('save')
  })
  clearChangesFilter('wt')
})

describe('showFileDiff', () => {
  it("replaces the edit tab with the Source Control diff at the editor's line", async () => {
    fixture.state.openFiles = [editTab]
    fixture.state.editorCursorLine = { [editTab.id]: 42 }
    fixture.state.gitBranchCompareSummaryByWorktree = { wt: { status: 'ready' } }

    expect(await showFileDiff(editTab.id)).toBe(true)

    expect(fixture.state.openDiffAtLocation).toHaveBeenCalledWith({
      worktreeId: 'wt',
      worktreePath: '/repo',
      relativePath: 'src/a.ts',
      preview: false,
      area: 'branch-worktree'
    })
    expect(fixture.calls).toEqual(['openDiff', `close:${editTab.id}`])
    expect(fixture.state.setPendingEditorReveal).toHaveBeenCalledOnce()
    expect(fixture.state.pendingEditorReveal).toEqual({
      filePath: '/repo/src/a.ts',
      line: 42,
      column: 1,
      matchLength: 0
    })
  })

  it('saves unsaved edits first, so the diff shows them', async () => {
    fixture.state.openFiles = [{ ...editTab, isDirty: true }]
    fixture.state.gitStatusByWorktree = { wt: [{ path: 'src/a.ts', area: 'unstaged' }] }

    expect(await showFileDiff(editTab.id)).toBe(true)

    expect(fixture.save).toHaveBeenCalledWith({ fileId: editTab.id })
    expect(fixture.calls).toEqual(['save', 'openDiff', `close:${editTab.id}`])
  })

  it('keeps the edit tab when the save fails', async () => {
    fixture.state.openFiles = [{ ...editTab, isDirty: true }]
    fixture.state.gitStatusByWorktree = { wt: [{ path: 'src/a.ts', area: 'unstaged' }] }
    fixture.save.mockRejectedValue(new Error('disk full'))

    expect(await showFileDiff(editTab.id)).toBe(false)

    expect(fixture.state.openDiffAtLocation).not.toHaveBeenCalled()
    expect(fixture.state.closeFile).not.toHaveBeenCalled()
  })

  it('stays in the editor when the filter shows no change for the file', async () => {
    fixture.state.openFiles = [editTab]
    fixture.state.gitBranchCompareSummaryByWorktree = { wt: { status: 'ready' } }
    setChangesFilter('wt', { kind: 'uncommitted' })

    expect(await showFileDiff(editTab.id)).toBe(false)

    expect(fixture.state.openDiffAtLocation).not.toHaveBeenCalled()
    expect(fixture.state.closeFile).not.toHaveBeenCalled()
  })

  it('stays in the editor while a commit is previewed, whose diff has no editor view', async () => {
    fixture.state.openFiles = [editTab]
    fixture.state.gitStatusByWorktree = { wt: [{ path: 'src/a.ts', area: 'unstaged' }] }
    setChangesFilter('wt', {
      kind: 'commit',
      compare: { commitOid: 'c1', parentOid: 'p1', compareRef: 'c1', baseRef: 'p1' },
      entries: [{ path: 'src/a.ts', status: 'modified' }]
    })

    expect(await showFileDiff(editTab.id)).toBe(false)
    expect(fixture.state.openDiffAtLocation).not.toHaveBeenCalled()
  })

  it('leaves a diff tab alone', async () => {
    fixture.state.openFiles = [diffTab]
    fixture.state.gitStatusByWorktree = { wt: [{ path: 'src/a.ts', area: 'unstaged' }] }

    expect(await showFileDiff(diffTab.id)).toBe(false)
    expect(fixture.state.openDiffAtLocation).not.toHaveBeenCalled()
  })
})

describe('showFileEdit', () => {
  it('replaces the diff tab with the file, opened at the diff line', () => {
    fixture.state.openFiles = [diffTab]

    showFileEdit(diffTab.id, 17)
    frames.splice(0).forEach((callback) => callback(0))
    frames.splice(0).forEach((callback) => callback(0))

    expect(fixture.state.openFile).toHaveBeenCalledWith({
      filePath: '/repo/src/a.ts',
      relativePath: 'src/a.ts',
      worktreeId: 'wt',
      runtimeEnvironmentId: null,
      language: 'typescript',
      mode: 'edit'
    })
    expect(fixture.calls).toEqual(['openFile', `close:${diffTab.id}`])
    expect(fixture.state.pendingEditorReveal).toEqual({
      filePath: '/repo/src/a.ts',
      line: 17,
      column: 1,
      matchLength: 0
    })
  })

  it('opens a markdown file in the view the toggle picked', () => {
    const markdownDiff = { ...diffTab, filePath: '/repo/README.md', relativePath: 'README.md' }
    fixture.state.openFiles = [markdownDiff]

    showFileEdit(markdownDiff.id, null, 'rich')

    expect(fixture.state.setEditorViewMode).toHaveBeenCalledWith('/repo/README.md', 'edit')
    expect(fixture.state.setMarkdownViewMode).toHaveBeenCalledWith('/repo/README.md', 'rich')
    expect(frames).toHaveLength(0)
  })
})
