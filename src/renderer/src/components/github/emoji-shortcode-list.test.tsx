// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmojiShortcodeList } from './emoji-shortcode-list'
import { GitHubMentionList } from './github-mention-autocomplete'

describe('autocomplete lists near the window edge', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps the emoji list inside the window when the caret is at the right edge', () => {
    render(
      <EmojiShortcodeList
        suggestions={[{ emoji: '👍', shortcode: 'thumbsup' }]}
        query="thu"
        activeIndex={0}
        anchor={{ left: window.innerWidth - 20, top: 400, bottom: 416 }}
        onPick={() => {}}
      />
    )
    const list = document.querySelector<HTMLElement>('[data-emoji-shortcode-list]')
    expect(Number.parseFloat(list?.style.left ?? '0') + 300).toBeLessThanOrEqual(window.innerWidth)
  })

  it('keeps the member list inside the window too', () => {
    render(
      <GitHubMentionList
        options={[{ login: 'octocat', name: 'Octo', avatarUrl: '', source: 'Member' }]}
        activeIndex={0}
        anchor={{ left: window.innerWidth - 20, top: 400, bottom: 416 }}
        onPick={() => {}}
      />
    )
    const list = document.querySelector<HTMLElement>('[role="listbox"]')
    expect(Number.parseFloat(list?.style.left ?? '0') + 260).toBeLessThanOrEqual(window.innerWidth)
  })
})
