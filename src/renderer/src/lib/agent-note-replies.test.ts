import { describe, expect, it } from 'vitest'
import type { DiffComment } from '../../../shared/diff-comment-types'
import { withAgentReplies } from './agent-note-replies'

function note(id: string, overrides: Partial<DiffComment> = {}): DiffComment {
  return {
    id,
    worktreeId: 'wt-1',
    filePath: 'src/a.ts',
    lineNumber: 3,
    body: id,
    createdAt: 1,
    side: 'modified',
    ...overrides
  }
}

const agent = { kind: 'agent' as const, name: 'Codex' }

describe('withAgentReplies', () => {
  it("puts an agent's reply under the user note it answers, not beside it", () => {
    const user = note('u1')
    const reply = note('r1', { agentAuthor: agent, replyToNoteId: 'u1' })
    const standalone = note('a1', { agentAuthor: agent })

    expect(withAgentReplies([user], [reply, standalone])).toEqual([
      { ...user, agentReplies: [reply] },
      standalone
    ])
  })

  it('shows a reply on its own when the note it answers is gone', () => {
    const orphan = note('r1', { agentAuthor: agent, replyToNoteId: 'deleted' })
    expect(withAgentReplies([], [orphan])).toEqual([orphan])
  })
})
