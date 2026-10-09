import { describe, expect, it } from 'vitest'
import {
  definitionOpenTarget,
  pythonDefinitionContext,
  targetHasDiff,
  toEditorPosition,
  trackedFileContext
} from './python-definition'

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

describe('pythonDefinitionContext', () => {
  it("gives the file's worktree root, the main checkout and the repo's venv setting", () => {
    expect(pythonDefinitionContext(state, '/wt/e-4974/apps/backend/a.py')).toEqual({
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
    expect(pythonDefinitionContext(remote, '/remote/wt/a.py')).toBeNull()
    expect(pythonDefinitionContext(state, '/elsewhere/b.py')).toBeNull()
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

describe('toEditorPosition', () => {
  it('turns the zero-based server position into the one-based editor one', () => {
    expect(toEditorPosition({ filePath: '/a.py', line: 10, character: 6 })).toEqual({
      lineNumber: 11,
      column: 7
    })
  })
})
