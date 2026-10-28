import { describe, expect, it, vi } from 'vitest'
import { closeOtherViewOfFile } from './one-view-per-file'

const edit = {
  id: '/repo/a.ts',
  filePath: '/repo/a.ts',
  worktreeId: 'wt',
  mode: 'edit',
  isDirty: false
}
const unstaged = {
  id: 'wt::diff::unstaged::a.ts',
  filePath: '/repo/a.ts',
  worktreeId: 'wt',
  mode: 'diff',
  diffSource: 'unstaged',
  isDirty: false
}
const commit = { ...unstaged, id: 'wt::diff::commit::a.ts', diffSource: 'commit' }

function tab(entityId: string, groupId: string) {
  return { id: `tab:${entityId}:${groupId}`, entityId, groupId, contentType: 'editor' }
}

function state(files: Record<string, unknown>[], tabs: ReturnType<typeof tab>[]) {
  return {
    openFiles: files,
    editorDrafts: {} as Record<string, string>,
    unifiedTabsByWorktree: { wt: tabs },
    pendingEditorReveal: null,
    setPendingEditorReveal: vi.fn(),
    closeFile: vi.fn()
  }
}

describe('closeOtherViewOfFile', () => {
  it("closes the file's editor in the group where its diff opened", () => {
    const s = state([edit, unstaged], [tab(edit.id, 'g1'), tab(unstaged.id, 'g1')])

    closeOtherViewOfFile(s as never, unstaged.id, 'g1')

    expect(s.closeFile).toHaveBeenCalledWith(edit.id)
  })

  it("closes the file's working diff where its editor opened, but not a commit's diff", () => {
    const s = state(
      [edit, unstaged, commit],
      [tab(edit.id, 'g1'), tab(unstaged.id, 'g1'), tab(commit.id, 'g1')]
    )

    closeOtherViewOfFile(s as never, edit.id, 'g1')

    expect(s.closeFile.mock.calls).toEqual([[unstaged.id]])
  })

  it('keeps an editor with unsaved edits', () => {
    const s = state(
      [{ ...edit, isDirty: true }, unstaged],
      [tab(edit.id, 'g1'), tab(unstaged.id, 'g1')]
    )

    closeOtherViewOfFile(s as never, unstaged.id, 'g1')

    expect(s.closeFile).not.toHaveBeenCalled()
  })

  it('keeps a view that is also open in another split group', () => {
    const s = state(
      [edit, unstaged],
      [tab(edit.id, 'g1'), tab(edit.id, 'g2'), tab(unstaged.id, 'g1')]
    )

    closeOtherViewOfFile(s as never, unstaged.id, 'g1')

    expect(s.closeFile).not.toHaveBeenCalled()
  })

  it('leaves the other group alone', () => {
    const s = state([edit, unstaged], [tab(edit.id, 'g2'), tab(unstaged.id, 'g1')])

    closeOtherViewOfFile(s as never, unstaged.id, 'g1')

    expect(s.closeFile).not.toHaveBeenCalled()
  })
})
