// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeybindingActionId } from '../../../shared/keybindings'
import { handleTerminalWorkspaceEditorShortcut } from './terminal-workspace-editor-shortcuts'

const fixture = vi.hoisted(() => ({
  state: {
    activeTabType: 'editor',
    activeFileId: 'file-1',
    openFiles: [] as { id: string; mode: string }[]
  },
  showFileDiff: vi.fn(async () => true)
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => fixture.state } }))
vi.mock('./editor/file-tab-view-switch', () => ({ showFileDiff: fixture.showFileDiff }))
vi.mock('./editor/diff-shortcuts-outside-editor', () => ({
  handleDiffShortcutOutsideEditor: () => false
}))

function pressShowDiff(): { handled: boolean; event: KeyboardEvent } {
  const event = new KeyboardEvent('keydown', { key: '∂', code: 'KeyD', cancelable: true })
  const handled = handleTerminalWorkspaceEditorShortcut({
    event,
    floatingWorkspaceFocused: false,
    matchShortcut: (id: KeybindingActionId) => id === 'editor.showDiff',
    notifyTerminalCapture: vi.fn()
  })
  return { handled, event }
}

afterEach(() => {
  fixture.showFileDiff.mockClear()
})

describe('Show File Diff shortcut', () => {
  it("switches the active file's editor to its diff", () => {
    fixture.state.openFiles = [{ id: 'file-1', mode: 'edit' }]

    const { handled, event } = pressShowDiff()

    expect(handled).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(fixture.showFileDiff).toHaveBeenCalledWith('file-1')
  })

  it('lets the chord pass when the diff is already showing', () => {
    fixture.state.openFiles = [{ id: 'file-1', mode: 'diff' }]

    expect(pressShowDiff().handled).toBe(false)
    expect(fixture.showFileDiff).not.toHaveBeenCalled()
  })
})
