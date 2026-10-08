import { describe, expect, it } from 'vitest'
import { agentFromNoteAuthor } from './agent-note-agent'

describe('agentFromNoteAuthor', () => {
  it('finds the agent behind the name an agent signs its note with', () => {
    expect(agentFromNoteAuthor('Claude Code')).toBe('claude')
    expect(agentFromNoteAuthor('claude')).toBe('claude')
    expect(agentFromNoteAuthor('Codex')).toBe('codex')
    expect(agentFromNoteAuthor('OpenCode')).toBe('opencode')
    expect(agentFromNoteAuthor('Cursor')).toBe('cursor')
  })

  it('knows nothing for a name it cannot place', () => {
    expect(agentFromNoteAuthor('Agent')).toBeNull()
    expect(agentFromNoteAuthor('')).toBeNull()
  })
})
