import { describe, expect, it } from 'vitest'
import {
  definitionOpenTarget,
  pythonDefinitionContext,
  toEditorPosition
} from './python-definition'

const state = {
  openFiles: [{ filePath: '/wt/e-4974/apps/backend/a.py', worktreeId: 'wt-1' }],
  worktreesByRepo: {
    'repo-1': [{ id: 'wt-1', path: '/wt/e-4974', repoId: 'repo-1' }],
    'repo-ssh': [{ id: 'wt-ssh', path: '/remote/wt', repoId: 'repo-ssh' }]
  },
  repos: [
    { id: 'repo-1', connectionId: null, pythonVenvPath: 'apps/backend/.venv' },
    { id: 'repo-ssh', connectionId: 'ssh-target' }
  ]
}

describe('pythonDefinitionContext', () => {
  it("gives the file's worktree root and the repo's venv setting", () => {
    expect(pythonDefinitionContext(state, '/wt/e-4974/apps/backend/a.py')).toEqual({
      worktreeId: 'wt-1',
      worktreeRoot: '/wt/e-4974',
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
      definitionOpenTarget(
        state,
        '/wt/e-4974/apps/backend/a.py',
        '/wt/e-4974/apps/backend/domain/frame_parameter.py'
      )
    ).toEqual({
      worktreeId: 'wt-1',
      filePath: '/wt/e-4974/apps/backend/domain/frame_parameter.py',
      relativePath: 'apps/backend/domain/frame_parameter.py'
    })
  })

  it('opens a target outside the worktree by its absolute path', () => {
    expect(
      definitionOpenTarget(state, '/wt/e-4974/apps/backend/a.py', '/opt/typeshed/builtins.pyi')
    ).toEqual({
      worktreeId: 'wt-1',
      filePath: '/opt/typeshed/builtins.pyi',
      relativePath: '/opt/typeshed/builtins.pyi'
    })
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
