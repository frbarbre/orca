import { describe, expect, it } from 'vitest'
import {
  definitionOpenTarget,
  languageServerEnabled,
  openFileContext,
  previewModelText,
  replaceableTabId,
  serverLanguageFor,
  targetHasDiff,
  toEditorPosition,
  trackedFileContext
} from './language-server-editor'

describe('serverLanguageFor', () => {
  it('sends Python to pyrefly and TypeScript or JavaScript to tsgo', () => {
    expect(serverLanguageFor('python')).toBe('python')
    expect(serverLanguageFor('typescript')).toBe('typescript')
    expect(serverLanguageFor('javascript')).toBe('typescript')
    expect(serverLanguageFor('markdown')).toBeNull()
  })
})

describe('languageServerEnabled', () => {
  it('is on unless the language is switched off', () => {
    expect(languageServerEnabled(null, 'python')).toBe(true)
    expect(languageServerEnabled({}, 'typescript')).toBe(true)
    expect(languageServerEnabled({ languageServers: { python: false } }, 'typescript')).toBe(true)
    expect(languageServerEnabled({ languageServers: { python: false } }, 'python')).toBe(false)
  })
})

const state = {
  openFiles: [{ filePath: '/wt/e-4974/apps/backend/a.py', worktreeId: 'wt-1' }],
  worktreesByRepo: {
    'repo-1': [{ id: 'wt-1', path: '/wt/e-4974', repoId: 'repo-1' }],
    'repo-ssh': [{ id: 'wt-ssh', path: '/remote/wt', repoId: 'repo-ssh' }]
  },
  repos: [
    { id: 'repo-1', path: '/repo', connectionId: null, pythonVenvPath: 'apps/backend/.venv' },
    { id: 'repo-ssh', path: '/remote/repo', connectionId: 'ssh-target' }
  ]
}

describe('openFileContext', () => {
  it("gives the file's worktree root, the main checkout and the repo's venv setting", () => {
    expect(openFileContext(state, '/wt/e-4974/apps/backend/a.py')).toEqual({
      worktreeId: 'wt-1',
      worktreeRoot: '/wt/e-4974',
      repoRoot: '/repo',
      venvSetting: 'apps/backend/.venv'
    })
  })

  it('has nothing for remote worktrees or files that are not open', () => {
    const remote = {
      ...state,
      openFiles: [{ filePath: '/remote/wt/a.py', worktreeId: 'wt-ssh' }]
    }
    expect(openFileContext(remote, '/remote/wt/a.py')).toBeNull()
    expect(openFileContext(state, '/elsewhere/b.py')).toBeNull()
  })
})

describe('definitionOpenTarget', () => {
  it('opens a target inside the worktree by its relative path', () => {
    expect(
      definitionOpenTarget(state, 'wt-1', '/wt/e-4974/apps/backend/domain/frame_parameter.py')
    ).toEqual({
      worktreeId: 'wt-1',
      filePath: '/wt/e-4974/apps/backend/domain/frame_parameter.py',
      relativePath: 'apps/backend/domain/frame_parameter.py'
    })
  })

  it('opens a target outside the worktree by its absolute path', () => {
    expect(definitionOpenTarget(state, 'wt-1', '/opt/typeshed/builtins.pyi')).toEqual({
      worktreeId: 'wt-1',
      filePath: '/opt/typeshed/builtins.pyi',
      relativePath: '/opt/typeshed/builtins.pyi'
    })
  })

  it('opens nothing for a remote worktree', () => {
    expect(definitionOpenTarget(state, 'wt-ssh', '/remote/wt/b.py')).toBeNull()
  })
})

describe('trackedFileContext', () => {
  it('turns a diff side into its file on disk, with the worktree and venv setting', () => {
    expect(
      trackedFileContext(state, { worktreeId: 'wt-1', relativePath: 'apps/backend/a.py' })
    ).toEqual({
      filePath: '/wt/e-4974/apps/backend/a.py',
      worktreeId: 'wt-1',
      worktreeRoot: '/wt/e-4974',
      repoRoot: '/repo',
      venvSetting: 'apps/backend/.venv'
    })
  })

  it('has nothing for a remote worktree', () => {
    expect(trackedFileContext(state, { worktreeId: 'wt-ssh', relativePath: 'a.py' })).toBeNull()
  })
})

describe('targetHasDiff', () => {
  const changes = {
    gitStatusByWorktree: { 'wt-1': [{ path: 'apps/backend/dirty.py' }] },
    gitBranchChangesByWorktree: { 'wt-1': [{ path: 'apps/backend/branch.py' }] },
    gitBranchCompareSummaryByWorktree: { 'wt-1': { status: 'ready' } }
  }

  it('is true for an uncommitted change or a branch change', () => {
    expect(targetHasDiff(changes, 'wt-1', 'apps/backend/dirty.py')).toBe(true)
    expect(targetHasDiff(changes, 'wt-1', 'apps/backend/branch.py')).toBe(true)
  })

  it('is false for an unchanged file, or a branch change before the compare is ready', () => {
    expect(targetHasDiff(changes, 'wt-1', 'apps/backend/clean.py')).toBe(false)
    const loading = {
      ...changes,
      gitBranchCompareSummaryByWorktree: { 'wt-1': { status: 'loading' } }
    }
    expect(targetHasDiff(loading, 'wt-1', 'apps/backend/branch.py')).toBe(false)
  })
})

describe('replaceableTabId', () => {
  const tab = (id: string, filePath: string, mode: string) => ({
    id,
    filePath,
    worktreeId: 'wt-1',
    mode,
    isDirty: false
  })
  const tabs = {
    activeFileId: '/repo/a.py',
    openFiles: [
      tab('/repo/a.py', '/repo/a.py', 'edit'),
      tab('diff:/repo/c.py', '/repo/c.py', 'diff'),
      tab('/repo/open.py', '/repo/open.py', 'edit')
    ],
    editorDrafts: {}
  }
  const fromA = { worktreeId: 'wt-1', filePath: '/repo/a.py', inDiff: false }

  it("is the active tab the jump started in, so the target takes that tab's place", () => {
    expect(replaceableTabId(tabs, fromA, '/repo/b.py')).toBe('/repo/a.py')
    expect(
      replaceableTabId(
        { ...tabs, activeFileId: 'diff:/repo/c.py' },
        { worktreeId: 'wt-1', filePath: '/repo/c.py', inDiff: true },
        '/repo/b.py'
      )
    ).toBe('diff:/repo/c.py')
  })

  it('keeps a tab with unsaved changes', () => {
    const dirty = { ...tabs, openFiles: [{ ...tabs.openFiles[0], isDirty: true }] }
    const drafted = { ...tabs, editorDrafts: { '/repo/a.py': 'x = 1' } }
    expect(replaceableTabId(dirty, fromA, '/repo/b.py')).toBeNull()
    expect(replaceableTabId(drafted, fromA, '/repo/b.py')).toBeNull()
  })

  it('keeps the tab when the target already has its own tab', () => {
    expect(replaceableTabId(tabs, fromA, '/repo/open.py')).toBeNull()
  })

  it('keeps a tab showing more than the source file, like the all-changes view', () => {
    expect(
      replaceableTabId(
        { ...tabs, activeFileId: 'diff:/repo/c.py' },
        { worktreeId: 'wt-1', filePath: '/repo/d.py', inDiff: true },
        '/repo/b.py'
      )
    ).toBeNull()
  })
})

describe('previewModelText', () => {
  it("puts the target's lines at their own line number, so Monaco previews the right ones", () => {
    const text = previewModelText({ filePath: '/b.py', line: 2, character: 4, preview: 'def b():' })
    expect(text.split('\n')).toEqual(['', '', 'def b():'])
  })

  it('still reaches the line when the server sent no lines', () => {
    const text = previewModelText({ filePath: '/b.py', line: 1, character: 0 })
    expect(text.split('\n')).toHaveLength(2)
  })
})

describe('toEditorPosition', () => {
  it('turns the zero-based server position into the one-based editor one', () => {
    expect(toEditorPosition({ filePath: '/a.py', line: 10, character: 6 })).toEqual({
      lineNumber: 11,
      column: 7
    })
  })
})
