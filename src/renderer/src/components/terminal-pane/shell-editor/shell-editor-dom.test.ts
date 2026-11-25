import { describe, expect, it } from 'vitest'
import { displayShellEditorCwd, readShellEditorCaret } from './shell-editor-dom'

describe('readShellEditorCaret', () => {
  it('knows when the caret sits on the first or last line', () => {
    const value = 'one\ntwo\nthree'
    expect(readShellEditorCaret({ value, selectionStart: 2, selectionEnd: 2 })).toEqual({
      caretOnFirstLine: true,
      caretOnLastLine: false
    })
    expect(readShellEditorCaret({ value, selectionStart: 5, selectionEnd: 5 })).toEqual({
      caretOnFirstLine: false,
      caretOnLastLine: false
    })
    expect(readShellEditorCaret({ value, selectionStart: 10, selectionEnd: 10 })).toEqual({
      caretOnFirstLine: false,
      caretOnLastLine: true
    })
  })

  it('leaves the arrows to the text field while text is selected', () => {
    expect(readShellEditorCaret({ value: 'ls', selectionStart: 0, selectionEnd: 2 })).toEqual({
      caretOnFirstLine: false,
      caretOnLastLine: false
    })
  })
})

describe('displayShellEditorCwd', () => {
  it('shortens the home folder', () => {
    expect(displayShellEditorCwd('/Users/me/Documents/orca')).toBe('~/Documents/orca')
    expect(displayShellEditorCwd('/home/me')).toBe('~')
    expect(displayShellEditorCwd('/Users/meander-x/a')).toBe('~/a')
    expect(displayShellEditorCwd('/var/tmp')).toBe('/var/tmp')
  })
})
