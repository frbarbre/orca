import { describe, expect, it } from 'vitest'
import { activeFileKind, panelForFileKindChange } from './right-sidebar-follows-file'

const files = [
  { id: 'a.py', mode: 'edit' },
  { id: 'diff:b.py', mode: 'diff' },
  { id: 'conflicts', mode: 'conflict-review' },
  { id: 'checks', mode: 'check-details' }
]

function state(activeFileId: string | null, overrides: Record<string, unknown> = {}) {
  return {
    activeFileId,
    activeTabType: 'editor',
    openFiles: files,
    editorViewMode: {},
    ...overrides
  }
}

describe('activeFileKind', () => {
  it('tells a diff from a plain file', () => {
    expect(activeFileKind(state('a.py'))).toBe('file')
    expect(activeFileKind(state('diff:b.py'))).toBe('diff')
    expect(activeFileKind(state('conflicts'))).toBe('diff')
  })

  it('counts a file shown in its changes view as a diff', () => {
    expect(activeFileKind(state('a.py', { editorViewMode: { 'a.py': 'changes' } }))).toBe('diff')
  })

  it('has no kind for a terminal, a browser or a non-file tab', () => {
    expect(activeFileKind(state('a.py', { activeTabType: 'terminal' }))).toBeNull()
    expect(activeFileKind(state('checks'))).toBeNull()
    expect(activeFileKind(state(null))).toBeNull()
  })
})

describe('panelForFileKindChange', () => {
  it('shows source control for a diff and the explorer for a file when the kind changes', () => {
    expect(panelForFileKindChange('file', 'diff', 'explorer')).toBe('source-control')
    expect(panelForFileKindChange('diff', 'file', 'source-control')).toBe('explorer')
  })

  it('leaves the panel the user picked while the kind stays the same', () => {
    expect(panelForFileKindChange('file', 'file', 'pr-checks')).toBeNull()
    expect(panelForFileKindChange('diff', 'diff', 'explorer')).toBeNull()
  })

  it('does nothing on start, for a non-file tab, or when the panel is already right', () => {
    expect(panelForFileKindChange(null, 'diff', 'explorer')).toBeNull()
    expect(panelForFileKindChange('file', null, 'explorer')).toBeNull()
    expect(panelForFileKindChange('file', 'diff', 'source-control')).toBeNull()
  })
})
