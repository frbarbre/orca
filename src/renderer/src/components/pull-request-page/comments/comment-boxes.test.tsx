// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GHCommentComposer } from './composer'
import { CommentReplyForm } from './reply-form'
import { ConversationDescription } from '../conversation/description'
import { TooltipProvider } from '@/components/ui/tooltip'

const composerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
vi.mock('@/components/composer/Composer', () => ({
  Composer: (props: Record<string, unknown>) => {
    composerProps.current = props
    return null
  }
}))

afterEach(() => {
  cleanup()
  composerProps.current = null
})

const people = [{ login: 'madsenmm', source: 'Commenter' }]

describe('pull request page comment boxes', () => {
  it('writes a new comment in the GitHub composer, which names people and files', () => {
    render(
      <TooltipProvider>
        <GHCommentComposer
          repoPath="/repo"
          issueNumber={7}
          itemType="pr"
          mentionOptions={people}
          onCommentAdded={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(composerProps.current).toMatchObject({ context: 'github', people })
  })

  it('writes a reply in the GitHub composer', () => {
    render(
      <CommentReplyForm
        placeholder="Reply"
        mentionOptions={people}
        draftKey="reply-draft"
        onCancel={vi.fn()}
        onSubmit={vi.fn(async () => true)}
      />
    )
    expect(composerProps.current).toMatchObject({ context: 'github', people, autoFocus: true })
  })

  it('edits the description in the GitHub composer, with the formatting toolbar', () => {
    render(
      <ConversationDescription
        authorLabel="octocat"
        updatedAt="2026-10-20T00:00:00Z"
        canEditBody
        loading={false}
        detailsLoaded
        bodyEditing
        bodySaving={false}
        bodyChanged={false}
        body="Body"
        resolvedBodyDraft="Body"
        mentionOptions={people}
        markdownGitHubRepo={null}
        onCancelEdit={vi.fn()}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
        onDraftChange={vi.fn()}
      />
    )
    expect(composerProps.current).toMatchObject({
      context: 'github',
      people,
      toolbar: true,
      autoFocus: true
    })
  })
})
