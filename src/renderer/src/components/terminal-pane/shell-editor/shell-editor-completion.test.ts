import { describe, expect, it } from 'vitest'
import {
  applyCompletion,
  completionWordStart,
  filterCompletionMenu,
  moveCompletionSelection,
  openCompletionMenu,
  resolveCompletionMenuKey
} from './shell-editor-completion'

const item = (value: string, description: string | null = null) => ({ value, description })

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

describe('completion menu', () => {
  const items = [item('checkout', 'switch branches'), item('cherry'), item('cherry-pick')]

  it('opens on the word being completed, with the first entry picked', () => {
    expect(openCompletionMenu(items, 'git che', 7)).toEqual({
      items,
      visible: items,
      selected: 0,
      wordStart: 4
    })
    expect(openCompletionMenu([], 'git che', 7)).toBeNull()
  })

  it('narrows as more is typed, and closes when nothing fits or the caret leaves the word', () => {
    const menu = openCompletionMenu(items, 'git che', 7)!
    expect(filterCompletionMenu(menu, 'git cherr', 9)?.visible).toEqual([
      item('cherry'),
      item('cherry-pick')
    ])
    expect(filterCompletionMenu(menu, 'git chx', 7)).toBeNull()
    expect(filterCompletionMenu(menu, 'git', 3)).toBeNull()
  })

  it('moves the pick around, wrapping at both ends', () => {
    const menu = openCompletionMenu(items, 'git che', 7)!
    expect(moveCompletionSelection(menu, 1).selected).toBe(1)
    expect(moveCompletionSelection(menu, -1).selected).toBe(2)
    expect(moveCompletionSelection({ ...menu, selected: 2 }, 1).selected).toBe(0)
  })
})
