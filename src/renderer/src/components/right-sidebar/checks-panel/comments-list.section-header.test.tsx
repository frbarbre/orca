// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PRComment } from '../../../../../shared/github/comment-types'
import { clearPRCommentsListSelectionsForTests } from '../pr-comments-list-selection'
import { PRCommentsList } from './comments-list'

afterEach(() => {
  cleanup()
  clearPRCommentsListSelectionsForTests()
})

const comment: PRComment = {
  id: 1,
  author: 'alice',
  authorAvatarUrl: '',
  body: 'Please update this.',
  createdAt: '2026-05-14T00:00:00Z',
  url: 'https://github.com/acme/widgets/pull/42#discussion_r1'
}

describe('PRCommentsList as a PR panel section', () => {
  it('heads the comments with the shared section header, the comment actions in it', () => {
    render(
      <TooltipProvider>
        <PRCommentsList
          sectionHeader
          comments={[comment]}
          commentsLoading={false}
          selectionContextKey="review:42"
          onAddComment={vi.fn()}
        />
      </TooltipProvider>
    )
    const heading = screen.getByRole('button', { name: /Comments/ })
    expect(heading.textContent).toContain('1')
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeTruthy()
    expect(screen.getByText('Please update this.')).toBeTruthy()

    fireEvent.click(heading)
    expect(screen.queryByText('Please update this.')).toBeNull()
    expect(screen.getByRole('button', { name: /Comments/ })).toBeTruthy()
  })

  describe('the audience tabs', () => {
    const bot: PRComment = {
      ...comment,
      id: 3,
      author: 'coderabbitai',
      isBot: true,
      body: 'Bot says hi.'
    }
    const resolved: PRComment = {
      ...comment,
      id: 4,
      body: 'Already fixed.',
      threadId: 'T4',
      isResolved: true
    }

    function renderList(comments: PRComment[]): void {
      render(
        <TooltipProvider>
          <PRCommentsList
            sectionHeader
            comments={comments}
            commentsLoading={false}
            selectionContextKey="review:42"
          />
        </TooltipProvider>
      )
    }

    function tab(label: string): HTMLElement {
      return screen.getByRole('button', { name: new RegExp(`^${label}`) })
    }

    it('open on Humans', () => {
      renderList([comment, bot])

      expect(tab('Humans').getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText('Please update this.')).toBeTruthy()
      expect(screen.queryByText('Bot says hi.')).toBeNull()
    })

    it('leave resolved threads out of every count, the section header included', () => {
      renderList([comment, bot, resolved])

      expect(tab('All').textContent).toContain('2')
      expect(tab('Humans').textContent).toContain('1')
      expect(tab('Bots').textContent).toContain('1')
      expect(screen.getByRole('button', { name: /^Comments/ }).textContent).toContain('2')
    })

    it('say so when the chosen audience has nothing left', () => {
      renderList([bot, resolved])

      expect(screen.getByText('No human comments.')).toBeTruthy()
    })
  })

  it('lists open threads without a Needs review heading over them', () => {
    render(
      <TooltipProvider>
        <PRCommentsList
          sectionHeader
          comments={[
            { ...comment, threadId: 'T1', isResolved: false, path: 'src/app.ts', line: 3 }
          ]}
          commentsLoading={false}
          selectionContextKey="review:42"
        />
      </TooltipProvider>
    )
    expect(screen.getByText('Please update this.')).toBeTruthy()
    expect(screen.queryByText(/Needs review/)).toBeNull()
  })

  it('draws no separator under the audience tabs', () => {
    render(
      <TooltipProvider>
        <PRCommentsList
          sectionHeader
          comments={[comment]}
          commentsLoading={false}
          selectionContextKey="review:42"
        />
      </TooltipProvider>
    )
    const tabs = screen.getByRole('button', { name: /^All/ }).closest('div')?.parentElement
    expect(tabs?.className).toContain('border-b-0')
  })

  it('leaves resolved threads to their own Resolved section', () => {
    render(
      <TooltipProvider>
        <PRCommentsList
          sectionHeader
          comments={[
            comment,
            { ...comment, id: 2, body: 'Done already.', threadId: 'T2', isResolved: true }
          ]}
          commentsLoading={false}
          selectionContextKey="review:42"
        />
      </TooltipProvider>
    )
    expect(screen.getByText('Please update this.')).toBeTruthy()
    expect(screen.queryByText(/Resolved ·/)).toBeNull()
  })
})
