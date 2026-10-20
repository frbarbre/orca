// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GHCommentComposer } from './gh-comment-composer'
import { CommentReplyForm } from './comment-reply-form'
import { ConversationTabDescription } from './conversation-tab-description'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { GitHubWorkItem } from '../../../../../shared/github/work-item-types'

const composerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/components/composer/Composer', () => ({
  Composer: (props: Record<string, unknown>) => {
    composerProps.current = props
    return null
  }
}))
vi.mock('@/components/github/GitHubMarkdownComposer', () => ({
  GitHubMarkdownComposer: () => null
}))

afterEach(() => {
  cleanup()
  composerProps.current = null
})

describe('GitHub item dialog comment boxes', () => {
  it('writes a new comment in the GitHub composer, with the formatting toolbar', () => {
    render(
      <TooltipProvider>
        <GHCommentComposer
          repoPath="/repo"
          issueNumber={7}
          itemType="pr"
          onCommentAdded={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(composerProps.current).toMatchObject({ context: 'github', toolbar: true })
  })

  it('writes a reply in the GitHub composer', () => {
    render(
      <CommentReplyForm
        placeholder="Reply"
        draftKey="reply-draft"
        onCancel={vi.fn()}
        onSubmit={vi.fn(async () => true)}
      />
    )
    expect(composerProps.current).toMatchObject({
      context: 'github',
      toolbar: true,
      autoFocus: true
    })
  })

  it('edits the description in the GitHub composer', () => {
    render(
      <TooltipProvider>
        <ConversationTabDescription
          item={{ updatedAt: '2026-10-20T00:00:00Z' } as GitHubWorkItem}
          authorLabel="octocat"
          canEditBody
          loading={false}
          detailsLoaded
          bodyEditing
          bodySaving={false}
          bodyChanged={false}
          body="Body"
          resolvedBodyDraft="Body"
          markdownGitHubRepo={null}
          setBodyDraft={vi.fn()}
          setBodyEditing={vi.fn()}
          onSaveBody={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(composerProps.current).toMatchObject({
      context: 'github',
      toolbar: true,
      autoFocus: true
    })
  })
})
