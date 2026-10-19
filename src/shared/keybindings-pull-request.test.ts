import { describe, expect, it } from 'vitest'
import { keybindingMatchesAction } from './keybindings'

describe('pull request shortcuts', () => {
  it('opens the pull request with Option+Cmd+G on macOS, where Option+G types ©', () => {
    expect(
      keybindingMatchesAction(
        'sourceControl.openPullRequest',
        { key: '©', code: 'KeyG', control: false, meta: true, alt: true, shift: false },
        'darwin'
      )
    ).toBe(true)
  })

  it('copies its URL with Shift+Option+Cmd+G on macOS', () => {
    expect(
      keybindingMatchesAction(
        'sourceControl.copyPullRequestUrl',
        { key: '˝', code: 'KeyG', control: false, meta: true, alt: true, shift: true },
        'darwin'
      )
    ).toBe(true)
  })
})
