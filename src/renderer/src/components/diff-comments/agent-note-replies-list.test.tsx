// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { NoteThread } from './agent-note-replies-list'
import { reloadSavedDraftsForTests } from '@/lib/saved-drafts'

const mocks = vi.hoisted(() => ({ addDiffComment: vi.fn(), sendNotesToBestAgent: vi.fn() }))

vi.mock('@/store', () => {
  const state = {
    addDiffComment: mocks.addDiffComment,
    tabsByWorktree: {},
    agentStatusByPaneKey: {}
  }
  return {
    useAppStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
      getState: () => state
    })
  }
})
vi.mock('@/lib/send-notes-to-best-agent', () => ({
  sendNotesToBestAgent: mocks.sendNotesToBestAgent
}))
vi.mock('@/components/composer/Composer', async () => ({
  Composer: (await import('@/components/composer/composer-test-double')).ComposerTestDouble
}))

const root: DiffComment = {
  id: 'a1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  lineNumber: 3,
  body: 'Loaded layers start closed.',
  createdAt: 1,
  side: 'modified',
  agentAuthor: { kind: 'agent', name: 'Codex' }
}

describe('NoteThread reply box', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    localStorage.clear()
    reloadSavedDraftsForTests()
  })

  it('keeps an unsent follow-up and reopens with it after a restart', () => {
    const first = render(
      <NoteThread root={root} replies={[]} worktreeId="wt-1" onDelete={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByPlaceholderText('Ask a follow-up…'), {
      target: { value: 'Half a question' }
    })
    first.unmount()

    reloadSavedDraftsForTests()
    render(<NoteThread root={root} replies={[]} worktreeId="wt-1" onDelete={vi.fn()} />)
    expect(screen.getByPlaceholderText('Ask a follow-up…')).toHaveProperty(
      'value',
      'Half a question'
    )
  })

  it('asks the follow-up in the shared agent composer, scoped to the thread’s workspace', () => {
    render(<NoteThread root={root} replies={[]} worktreeId="wt-1" onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(screen.getByPlaceholderText('Ask a follow-up…').getAttribute('data-composer')).toBe(
      'agent'
    )
  })

  it('sends a submitted follow-up straight to an agent, with the unsent ones before it', async () => {
    const earlier: DiffComment = {
      ...root,
      id: 'u1',
      body: 'Why?',
      agentAuthor: undefined,
      replyToNoteId: 'a1'
    }
    const saved: DiffComment = { ...earlier, id: 'u2', body: 'And the tests?' }
    mocks.addDiffComment.mockResolvedValue(saved)
    render(
      <NoteThread
        root={root}
        replies={[earlier]}
        worktreeId="wt-1"
        groupId="g-1"
        onDelete={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    fireEvent.change(screen.getByPlaceholderText('Ask a follow-up…'), {
      target: { value: 'And the tests?' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add reply' }))

    await vi.waitFor(() =>
      expect(mocks.sendNotesToBestAgent).toHaveBeenCalledWith({
        worktreeId: 'wt-1',
        notes: [earlier, saved],
        groupId: 'g-1'
      })
    )
  })
})
