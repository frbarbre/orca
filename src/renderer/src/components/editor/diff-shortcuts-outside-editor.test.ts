// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeybindingActionId } from '../../../../shared/keybindings'

type MockState = {
  rightSidebarOpen: boolean
  rightSidebarTab: string
  activeTabType: string
  activeFileId: string | null
  openFiles: { id: string; mode: string }[]
  stepToChangedFile: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const state: MockState = {
    rightSidebarOpen: true,
    rightSidebarTab: 'source-control',
    activeTabType: 'terminal',
    activeFileId: null,
    openFiles: [],
    stepToChangedFile: vi.fn()
  }
  return { state }
})

vi.mock('../../store', () => ({
  useAppStore: { getState: () => mocks.state }
}))

import {
  handleDiffShortcutOutsideEditor,
  registerDiffEditorForOutsideShortcuts
} from './diff-shortcuts-outside-editor'

function press(target: Element, key = 'F7'): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  Object.defineProperty(event, 'target', { value: target })
  return event
}

const matching =
  (actionId: KeybindingActionId) =>
  (id: KeybindingActionId): boolean =>
    id === actionId

describe('handleDiffShortcutOutsideEditor', () => {
  let unregister: (() => void) | null = null

  beforeEach(() => {
    mocks.state.rightSidebarOpen = true
    mocks.state.rightSidebarTab = 'source-control'
    mocks.state.stepToChangedFile.mockReset()
    document.body.innerHTML =
      '<div id="sidebar"></div><input id="field" /><textarea id="note"></textarea>'
  })

  afterEach(() => {
    unregister?.()
    unregister = null
  })

  it('opens the first changed file when no diff editor is open', () => {
    const event = press(document.body)

    expect(handleDiffShortcutOutsideEditor(event, matching('editor.nextFile'))).toBe(true)
    expect(mocks.state.stepToChangedFile).toHaveBeenCalledWith('next')
  })

  it('opens the last changed file for the previous-file shortcut', () => {
    handleDiffShortcutOutsideEditor(press(document.body), matching('editor.previousFile'))

    expect(mocks.state.stepToChangedFile).toHaveBeenCalledWith('previous')
  })

  it('leaves a press typed into an input or textarea alone', () => {
    for (const id of ['field', 'note']) {
      const event = press(document.getElementById(id)!)
      expect(handleDiffShortcutOutsideEditor(event, matching('editor.nextFile'))).toBe(false)
    }
    expect(mocks.state.stepToChangedFile).not.toHaveBeenCalled()
  })

  it('does nothing while no diff panel is open', () => {
    mocks.state.rightSidebarOpen = false

    expect(handleDiffShortcutOutsideEditor(press(document.body), matching('editor.nextFile'))).toBe(
      false
    )
  })

  it('hands the press to the open diff editor and focuses it', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const focus = vi.fn()
    const received: string[] = []
    container.addEventListener(
      'keydown',
      (event) => {
        received.push(event.key)
        event.preventDefault()
      },
      true
    )
    unregister = registerDiffEditorForOutsideShortcuts({
      getShortcutTarget: () => container,
      focus
    })

    const event = press(document.body)
    expect(handleDiffShortcutOutsideEditor(event, matching('editor.nextChange'))).toBe(true)
    expect(focus).toHaveBeenCalled()
    expect(received).toEqual(['F7'])
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves a press inside the diff editor to the editor', () => {
    const editor = document.createElement('div')
    editor.className = 'monaco-editor'
    document.body.append(editor)
    const focus = vi.fn()
    unregister = registerDiffEditorForOutsideShortcuts({ getShortcutTarget: () => editor, focus })

    expect(handleDiffShortcutOutsideEditor(press(editor), matching('editor.nextChange'))).toBe(
      false
    )
    expect(focus).not.toHaveBeenCalled()
  })

  it('keeps a bare-key binding away from a focused list or button', () => {
    const button = document.createElement('button')
    document.body.append(button)
    const focus = vi.fn()
    unregister = registerDiffEditorForOutsideShortcuts({ getShortcutTarget: () => button, focus })

    expect(
      handleDiffShortcutOutsideEditor(press(button, 'ArrowDown'), matching('editor.nextChange'))
    ).toBe(false)
    expect(focus).not.toHaveBeenCalled()
  })

  it('acts on a bare-key binding once nothing holds focus', () => {
    const container = document.createElement('div')
    document.body.append(container)
    container.addEventListener('keydown', (event) => event.preventDefault(), true)
    const focus = vi.fn()
    unregister = registerDiffEditorForOutsideShortcuts({
      getShortcutTarget: () => container,
      focus
    })

    expect(
      handleDiffShortcutOutsideEditor(
        press(document.body, 'ArrowDown'),
        matching('editor.nextChange')
      )
    ).toBe(true)
    expect(focus).toHaveBeenCalled()
  })

  it('ignores chords that are not review shortcuts', () => {
    expect(handleDiffShortcutOutsideEditor(press(document.body), () => false)).toBe(false)
  })
})
