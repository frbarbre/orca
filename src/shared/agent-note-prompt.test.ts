import { describe, expect, it } from 'vitest'
import type { DiffComment } from './diff-comment-types'
import {
  formatDiffCommentsForAgent,
  githubCommentAgentNoteInstruction,
  REVIEW_AGENT_NOTE_INSTRUCTION
} from './agent-note-prompt'
import { DEFAULT_WORKSPACE_ACTION_PROMPTS } from './workspace-action-prompts'
import { DEFAULT_REVIEW_PROMPT_TEMPLATE } from './workspace-status-rule-config'

const note: DiffComment = {
  id: 'n1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  lineNumber: 4,
  body: 'Rename this',
  createdAt: 1,
  side: 'modified'
}

describe('agent note prompt instructions', () => {
  it('asks the agent to answer diff notes with agent notes on the changed lines', () => {
    const prompt = formatDiffCommentsForAgent([note])
    expect(prompt).toContain('File: src/a.ts')
    expect(prompt).toContain('User comment: "Rename this"')
    expect(prompt).toContain('Note id: n1')
    expect(prompt).toContain('orca notes reply --id <note id>')
  })

  it('gives a follow-up the earlier messages of its thread', () => {
    const agentRoot: DiffComment = {
      ...note,
      id: 'a1',
      body: 'Loaded layers start closed.',
      agentAuthor: { kind: 'agent', name: 'Codex' }
    }
    const followUp: DiffComment = { ...note, id: 'u2', body: 'Why closed?', replyToNoteId: 'a1' }

    const prompt = formatDiffCommentsForAgent([followUp], () => [agentRoot])

    expect(prompt).toContain('Earlier in this thread:')
    expect(prompt).toContain('- Codex: "Loaded layers start closed."')
    expect(prompt).toContain('User comment: "Why closed?"')
    expect(prompt).toContain('Note id: u2')
  })

  it('hands the agent the GitHub comment link to pass back', () => {
    const url = 'https://github.com/acme/app/pull/12#discussion_r1'
    const instruction = githubCommentAgentNoteInstruction(url)
    expect(instruction).toContain(`--github-comment ${url}`)
    expect(githubCommentAgentNoteInstruction(undefined)).toContain('--github-comment <comment url>')
  })

  it('asks a reviewing agent to pin its findings to the lines as agent notes', () => {
    expect(REVIEW_AGENT_NOTE_INSTRUCTION).toContain('orca notes add')
    expect(DEFAULT_WORKSPACE_ACTION_PROMPTS.reviewPullRequest).toContain(
      REVIEW_AGENT_NOTE_INSTRUCTION
    )
    expect(DEFAULT_REVIEW_PROMPT_TEMPLATE).toContain(REVIEW_AGENT_NOTE_INSTRUCTION)
  })
})
