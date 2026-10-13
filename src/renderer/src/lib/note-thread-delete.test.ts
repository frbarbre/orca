import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('@/lib/agent-notes', () => ({
  removeAgentNote: vi.fn(),
  selectWorktreeAgentNotes: vi.fn()
}))
vi.mock('@/store/worktree-diff-comments-selector', () => ({
  selectWorktreeDiffComments: vi.fn()
}))

import { collectNoteThread } from './note-thread-delete'

const note = (id: string, replyToNoteId?: string) => ({ id, replyToNoteId })

describe('collectNoteThread', () => {
  it('takes a root with every reply, from both the user notes and the agent notes', () => {
    const thread = collectNoteThread(
      'root',
      [note('u1', 'root'), note('u2'), note('u3', 'root')],
      [note('root'), note('a1', 'root'), note('a2', 'other')]
    )

    expect(thread.userIds.sort()).toEqual(['u1', 'u3'])
    expect(thread.agentIds.sort()).toEqual(['a1', 'root'])
  })

  it('deletes the replies before the root', () => {
    const thread = collectNoteThread('root', [note('u1', 'root')], [note('root')])

    expect(thread.agentIds.at(-1)).toBe('root')
  })

  it('takes only the note itself when it is a reply or has none', () => {
    const thread = collectNoteThread('a1', [], [note('root'), note('a1', 'root')])

    expect(thread).toEqual({ userIds: [], agentIds: ['a1'] })
  })
})
