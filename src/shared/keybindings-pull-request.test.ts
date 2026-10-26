import { describe, expect, it } from 'vitest'
import { getEffectiveKeybindingsForAction, keybindingMatchesAction } from './keybindings'

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

  it.each(['darwin', 'linux', 'win32'] as const)(
    'opens the preview deployment with Mod+Shift+P on %s',
    (platform) => {
      expect(
        getEffectiveKeybindingsForAction('sourceControl.openPullRequestPreview', platform)
      ).toEqual(['Mod+Shift+P'])
    }
  )

  it.each(['darwin', 'linux', 'win32'] as const)(
    'shows the Checks tab with Mod+Shift+K on %s',
    (platform) => {
      expect(getEffectiveKeybindingsForAction('sidebar.checks.toggle', platform)).toEqual([
        'Mod+Shift+K'
      ])
    }
  )

  it.each(['darwin', 'linux', 'win32'] as const)(
    'reviews the pull request with Mod+Alt+Shift+Enter on %s',
    (platform) => {
      expect(getEffectiveKeybindingsForAction('workspace.review', platform)).toEqual([
        'Mod+Alt+Shift+Enter'
      ])
    }
  )

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
