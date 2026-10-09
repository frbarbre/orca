// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import {
  renderDiffCommentZoneCard,
  type DiffCommentZoneCardContext
} from './diff-comment-zone-card'

vi.mock('../editor/NotesSendMenu', () => ({
  NotesSendMenu: () => <button type="button">Send notes to an agent</button>
}))

const revealGitHubComment = vi.hoisted(() => vi.fn())
vi.mock('@/lib/agent-notes', () => ({
  revealGitHubComment,
  earlierInThreadFromStore: () => () => []
}))

const addDiffComment = vi.hoisted(() => vi.fn())
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ addDiffComment }) }
}))

const agentNote: DiffComment = {
  id: 'agent-1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  startLine: 3,
  lineNumber: 5,
  body: 'Renamed fetchUser and updated both callers.',
  createdAt: 1,
  side: 'modified',
  agentAuthor: { kind: 'agent', name: 'Claude Code' }
}

describe('agent note zone card', () => {
  let container: HTMLDivElement
  let root: Root
  const onDelete = vi.fn()
  const onUpdate = vi.fn()

  function context(): DiffCommentZoneCardContext {
    return {
      worktreeId: 'wt-1',
      filePath: 'src/a.ts',
      activeGroupId: 'g-1',
      resizeZone: vi.fn(),
      onDeleteCommentRef: { current: onDelete },
      onUpdateCommentRef: { current: onUpdate },
      clearDeliveredDiffComments: vi.fn()
    }
  }

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('reads as a bot note: agent name and badge, no send or edit, still deletable', () => {
    act(() => renderDiffCommentZoneCard(root, agentNote, context()))

    const card = container.querySelector('.orca-diff-comment-card')
    expect(card?.getAttribute('data-agent-note')).toBe('true')
    expect(container.textContent).toContain('Claude Code')
    expect(container.textContent).toContain('Agent note')
    expect(
      card?.querySelector('[data-agent-note-icon]')?.getAttribute('data-agent-note-icon')
    ).toBe('claude')
    expect(container.textContent).not.toContain('Send notes to an agent')
    expect(container.querySelector('[aria-label="Edit note"]')).toBeNull()

    const remove = container.querySelector<HTMLButtonElement>('[aria-label="Delete note"]')
    act(() => remove?.click())
    expect(onDelete).toHaveBeenCalledWith('agent-1')
  })

  it('draws no divider when delete is the only action', () => {
    act(() => renderDiffCommentZoneCard(root, agentNote, context()))

    expect(container.querySelector('.orca-diff-comment-pill-divider')).toBeNull()
  })

  it('links to the GitHub comment it answers, inside Orca', () => {
    const url = 'https://github.com/acme/app/pull/12#discussion_r1'
    act(() => renderDiffCommentZoneCard(root, { ...agentNote, githubCommentUrl: url }, context()))

    const link = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show the GitHub comment"]'
    )
    act(() => link?.click())
    expect(revealGitHubComment).toHaveBeenCalledWith(url)
  })

  it("shows the agent's reply inside the user's note, deletable on its own", () => {
    const { agentAuthor: _agent, ...userNote } = agentNote
    const reply: DiffComment = {
      ...agentNote,
      id: 'reply-1',
      body: 'Done: renamed it.',
      replyToNoteId: userNote.id
    }
    act(() => renderDiffCommentZoneCard(root, { ...userNote, threadReplies: [reply] }, context()))

    const replyRow = container.querySelector('[data-agent-reply="reply-1"]')
    expect(replyRow?.textContent).toContain('Claude Code')
    expect(replyRow?.textContent).toContain('Done: renamed it.')

    const remove = replyRow?.querySelector<HTMLButtonElement>('[aria-label="Delete reply"]')
    act(() => remove?.click())
    expect(onDelete).toHaveBeenCalledWith('reply-1')
  })

  it('lets the user reply to an agent note, as a note in its thread', async () => {
    addDiffComment.mockReset()
    addDiffComment.mockResolvedValue({ id: 'u9' })
    const question: DiffComment = {
      ...agentNote,
      id: 'u1',
      body: 'Why is it closed?',
      agentAuthor: undefined,
      replyToNoteId: 'agent-1',
      createdAt: 2
    }
    act(() =>
      renderDiffCommentZoneCard(root, { ...agentNote, threadReplies: [question] }, context())
    )
    expect(container.querySelector('[data-agent-reply="u1"]')?.textContent).toContain('You')

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Reply"]')?.click())
    const input = container.querySelector<HTMLTextAreaElement>('textarea[data-note-thread-reply]')
    expect(input).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(input, 'And what about drafts?')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Add reply"]')?.click()
    )

    expect(addDiffComment).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      filePath: 'src/a.ts',
      startLine: 3,
      lineNumber: 5,
      body: 'And what about drafts?',
      side: 'modified',
      replyToNoteId: 'agent-1'
    })
  })

  it('keeps a user note as before', () => {
    const { agentAuthor: _agent, ...userNote } = agentNote
    act(() => renderDiffCommentZoneCard(root, userNote, context()))

    expect(
      container.querySelector('.orca-diff-comment-card')?.getAttribute('data-agent-note')
    ).toBeNull()
    expect(container.textContent).not.toContain('Agent note')
    expect(container.textContent).toContain('Send notes to an agent')
  })
})
