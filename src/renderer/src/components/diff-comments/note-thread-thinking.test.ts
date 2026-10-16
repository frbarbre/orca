import { describe, expect, it } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import { noteThreadAnsweredAt, noteThreadThinkingAgent } from './note-thread-thinking'

const note: DiffComment = {
  id: 'n1',
  worktreeId: 'wt',
  filePath: 'a.ts',
  lineNumber: 1,
  body: 'Why?',
  createdAt: 1,
  side: 'modified',
  sentAt: 2,
  sentToPaneKey: 'tab-1:leaf-1'
}

function status(state: AgentStatusEntry['state'], agentType = 'claude'): AgentStatusEntry {
  return { state, agentType, prompt: '', updatedAt: 1, stateStartedAt: 1 } as AgentStatusEntry
}

describe('noteThreadThinkingAgent', () => {
  it('names the agent working on the pane the last message went to', () => {
    expect(noteThreadThinkingAgent([note], ['tab-1'], { 'tab-1:leaf-1': status('working') })).toBe(
      'Claude'
    )
  })

  it('is null once that agent stops, or when the last message is a reply or unsent', () => {
    const statuses = { 'tab-1:leaf-1': status('done') }
    expect(noteThreadThinkingAgent([note], ['tab-1'], statuses)).toBeNull()
    const working = { 'tab-1:leaf-1': status('working') }
    const reply = { ...note, id: 'r1', agentAuthor: { kind: 'agent' as const, name: 'Codex' } }
    expect(noteThreadThinkingAgent([note, reply], ['tab-1'], working)).toBeNull()
    expect(noteThreadThinkingAgent([{ ...note, sentAt: undefined }], ['tab-1'], working)).toBeNull()
  })

  it('ignores other panes when it knows where the message went', () => {
    expect(
      noteThreadThinkingAgent([note], ['tab-1', 'tab-2'], { 'tab-2:leaf-1': status('working') })
    ).toBeNull()
  })

  it('is answered once the agent finished a turn after the question, even if it works again', () => {
    const busyAgain = {
      'tab-1:leaf-1': {
        ...status('working'),
        stateHistory: [
          { state: 'working', prompt: '', startedAt: 3 },
          { state: 'done', prompt: '', startedAt: 5 }
        ]
      } as AgentStatusEntry
    }
    expect(noteThreadThinkingAgent([note], ['tab-1'], busyAgain)).toBeNull()
    expect(noteThreadAnsweredAt([note], ['tab-1'], busyAgain)).toBe(5)
  })

  it('stays thinking while the turn that took the question is still going', () => {
    const answering = {
      'tab-1:leaf-1': {
        ...status('working'),
        stateHistory: [{ state: 'done', prompt: '', startedAt: 1 }]
      } as AgentStatusEntry
    }
    expect(noteThreadThinkingAgent([note], ['tab-1'], answering)).toBe('Claude')
    expect(noteThreadAnsweredAt([note], ['tab-1'], answering)).toBeNull()
  })

  it('never thinks about a question already marked answered', () => {
    const working = { 'tab-1:leaf-1': status('working') }
    expect(noteThreadThinkingAgent([{ ...note, answeredAt: 4 }], ['tab-1'], working)).toBeNull()
  })

  it("falls back to a working agent in the workspace when it doesn't know", () => {
    const unknown = { ...note, sentToPaneKey: undefined }
    const statuses = {
      'other-tab:leaf-1': status('working', 'codex'),
      'tab-2:leaf-1': status('working', 'codex')
    }
    expect(noteThreadThinkingAgent([unknown], ['tab-1', 'tab-2'], statuses)).toBe('Codex')
    expect(noteThreadThinkingAgent([unknown], ['tab-1'], statuses)).toBeNull()
  })
})
