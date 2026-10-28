// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { githubMentionMarkdownExtension } from './github-mention-hover-card'

const userProfile = vi.fn()

describe('GitHub mention hover card', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('api', { pendingReview: { userProfile } })
    userProfile.mockResolvedValue({
      login: 'madsenmm',
      name: 'Mads Madsen',
      avatarUrl: null,
      url: 'https://github.com/madsenmm',
      bio: 'Builds the frontend',
      company: '@flowbase',
      location: 'Copenhagen',
      isBot: false
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it("shows who a mentioned login is when it's hovered", async () => {
    act(() =>
      root.render(
        <CommentMarkdown
          content="@madsenmm Remember, mail me@example.com"
          extension={githubMentionMarkdownExtension}
        />
      )
    )
    const mention = container.querySelector<HTMLElement>('[data-github-mention="madsenmm"]')
    expect(mention?.textContent).toBe('@madsenmm')
    expect(container.querySelectorAll('[data-github-mention]')).toHaveLength(1)

    act(() => mention?.focus())

    await vi.waitFor(() => expect(document.body.textContent).toContain('Mads Madsen'))
    expect(userProfile).toHaveBeenCalledWith('madsenmm')
    expect(document.body.textContent).toContain('Builds the frontend')
    expect(document.body.textContent).toContain('Copenhagen')
  })
})
