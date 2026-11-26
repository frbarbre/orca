import { describe, expect, it } from 'vitest'
import {
  applyCompletion,
  completionKind,
  completionLabel,
  completionWordStart,
  filterCompletionMenu,
  moveCompletionSelection,
  openCompletionMenu,
  previewCompletion,
  resolveCompletionMenuKey
} from './shell-editor-completion'

const item = (value: string, tag: string | null = null, description: string | null = null) => ({
  value,
  description,
  tag
})

describe('completionWordStart', () => {
  it('finds the start of the word before the caret, keeping escaped spaces in it', () => {
    expect(completionWordStart('git che', 7)).toBe(4)
    expect(completionWordStart('ls my\\ fi', 9)).toBe(3)
    expect(completionWordStart('ls ', 3)).toBe(3)
    expect(completionWordStart('git che rest', 7)).toBe(4)
  })
})

describe('applyCompletion', () => {
  it('replaces the word with the pick and adds a space, except after a folder', () => {
    expect(applyCompletion('git che', 7, 'checkout')).toEqual({ text: 'git checkout ', caret: 13 })
    expect(applyCompletion('ls apps/fr', 10, 'apps/frontend/')).toEqual({
      text: 'ls apps/frontend/',
      caret: 17
    })
  })

  it('keeps what follows the caret and does not double its space', () => {
    expect(applyCompletion('git che --quiet', 7, 'checkout')).toEqual({
      text: 'git checkout --quiet',
      caret: 12
    })
  })
})

describe('completionKind and completionLabel', () => {
  it('reads what a candidate is from zsh’s tag, as Warp marks folders, files and commands', () => {
    expect(completionKind(item('apps/', 'local-directories'))).toBe('folder')
    expect(completionKind(item('apps/'))).toBe('folder')
    expect(completionKind(item('README.md', 'globbed-files'))).toBe('file')
    expect(completionKind(item('clang', 'commands'))).toBe('command')
    expect(completionKind(item('checkout', 'main-porcelain-commands'))).toBe('command')
    expect(completionKind(item('ll', 'aliases'))).toBe('command')
    expect(completionKind(item('--quiet', 'options'))).toBe('option')
    expect(completionKind(item('origin/main', 'remote-branch-names'))).toBe('other')
  })

  it('shows only the last part of a path, as Warp does', () => {
    expect(completionLabel('apps/desktop-app/')).toBe('desktop-app/')
    expect(completionLabel('~/.zshrc')).toBe('.zshrc')
    expect(completionLabel('checkout')).toBe('checkout')
    expect(completionLabel('origin/main')).toBe('main')
  })
})

describe('completion menu', () => {
  const items = [item('cherry'), item('checkout', null, 'switch branches'), item('cherry-pick')]

  it('opens sorted on the word being completed, with nothing picked yet', () => {
    expect(openCompletionMenu(items, 'git che', 7)).toEqual({
      items: [items[1], items[0], items[2]],
      visible: [items[1], items[0], items[2]],
      selected: -1,
      wordStart: 4,
      original: { text: 'git che', caret: 7 }
    })
    expect(openCompletionMenu([], 'git che', 7)).toBeNull()
  })

  it('narrows as more is typed, and closes when nothing fits or the caret leaves the word', () => {
    const menu = moveCompletionSelection(openCompletionMenu(items, 'git che', 7)!, 1)
    expect(filterCompletionMenu(menu, 'git cherr', 9)).toMatchObject({
      visible: [items[0], items[2]],
      selected: -1,
      original: { text: 'git cherr', caret: 9 }
    })
    expect(filterCompletionMenu(menu, 'git chx', 7)).toBeNull()
    expect(filterCompletionMenu(menu, 'git', 3)).toBeNull()
  })

  it('picks the first or last entry from nothing, then wraps', () => {
    const menu = openCompletionMenu(items, 'git che', 7)!
    expect(moveCompletionSelection(menu, 1).selected).toBe(0)
    expect(moveCompletionSelection(menu, -1).selected).toBe(2)
    expect(moveCompletionSelection({ ...menu, selected: 2 }, 1).selected).toBe(0)
    expect(moveCompletionSelection({ ...menu, selected: 0 }, -1).selected).toBe(2)
  })

  it('previews the pick in the line without the space it gets on taking it', () => {
    const menu = openCompletionMenu(items, 'git che --quiet', 7)!
    expect(previewCompletion(menu)).toBeNull()
    expect(previewCompletion(moveCompletionSelection(menu, 1))).toEqual({
      text: 'git checkout --quiet',
      caret: 12
    })
  })
})

describe('resolveCompletionMenuKey', () => {
  const key = (name: string, shiftKey = false) => ({
    key: name,
    shiftKey,
    ctrlKey: false,
    metaKey: false,
    altKey: false
  })

  it('moves with the arrows and Tab, takes the pick with Enter and closes with Escape', () => {
    expect(resolveCompletionMenuKey(key('ArrowDown'))).toBe('next')
    expect(resolveCompletionMenuKey(key('Tab'))).toBe('next')
    expect(resolveCompletionMenuKey(key('ArrowUp'))).toBe('previous')
    expect(resolveCompletionMenuKey(key('Tab', true))).toBe('previous')
    expect(resolveCompletionMenuKey(key('Enter'))).toBe('accept')
    expect(resolveCompletionMenuKey(key('Escape'))).toBe('close')
    expect(resolveCompletionMenuKey(key('a'))).toBeNull()
    expect(resolveCompletionMenuKey({ ...key('Enter'), metaKey: true })).toBeNull()
  })
})
