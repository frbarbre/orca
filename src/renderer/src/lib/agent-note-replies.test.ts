import { describe, expect, it } from 'vitest'
import type { DiffComment } from '../../../shared/diff-comment-types'
import { buildNoteThreads } from './agent-note-replies'

function note(id: string, createdAt: number, overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id,
    worktreeId: 'wt-1',
    filePath: 'src/a.ts',
    lineNumber: 3,
    body: id,
    createdAt,
    side: 'modified',
    ...overrides
  }
}

const agent = { kind: 'agent' as const, name: 'Codex' }

describe('buildNoteThreads', () => {
  it("puts an agent's reply and the user's follow-up under the user note, in order", () => {
    const user = note('u1', 1)
    const reply = note('r1', 2, { agentAuthor: agent, replyToNoteId: 'u1' })
    const followUp = note('u2', 3, { replyToNoteId: 'u1' })
    const standalone = note('a1', 4, { agentAuthor: agent })

    expect(buildNoteThreads([user, followUp], [standalone, reply])).toEqual([
      { ...user, threadReplies: [reply, followUp] },
      standalone
    ])
  })

  it("threads the user's question and the agent's answer under an agent note", () => {
    const agentRoot = note('a1', 1, { agentAuthor: agent })
    const question = note('u1', 2, { replyToNoteId: 'a1' })
    const answer = note('a2', 3, { agentAuthor: agent, replyToNoteId: 'a1' })

    expect(buildNoteThreads([question], [agentRoot, answer])).toEqual([
      { ...agentRoot, threadReplies: [question, answer] }
    ])
  })

  it('shows a reply on its own when the note it answers is gone', () => {
    const orphan = note('r1', 1, { agentAuthor: agent, replyToNoteId: 'deleted' })
    expect(buildNoteThreads([], [orphan])).toEqual([orphan])
  })
})
