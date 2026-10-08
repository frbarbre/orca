// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../../../shared/diff-comment-types'
import { AgentNoteFileBadge } from './agent-note-file-badge'

const harness = vi.hoisted(() => {
  const state: { notes: DiffComment[] } = { notes: [] }
  return state
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { activeWorktreeId: string }) => unknown) =>
    selector({ activeWorktreeId: 'wt-1' })
}))
vi.mock('@/lib/agent-notes', () => ({ useWorktreeAgentNotes: () => harness.notes }))

function note(id: string, filePath: string): DiffComment {
  return {
    id,
    worktreeId: 'wt-1',
    filePath,
    lineNumber: 1,
    body: 'done',
    createdAt: 1,
    side: 'modified',
    agentAuthor: { kind: 'agent', name: 'Codex' }
  }
}

describe('AgentNoteFileBadge', () => {
  afterEach(() => {
    cleanup()
  })

  it("counts the agent notes on this row's file", () => {
    harness.notes = [note('a', 'src/a.ts'), note('b', 'src/a.ts'), note('c', 'src/b.ts')]
    const { container } = render(<AgentNoteFileBadge filePath="src/a.ts" />)
    expect(container.textContent).toBe('2')
    expect(container.querySelector('[title="2 agent notes"]')).not.toBeNull()
  })

  it('shows nothing for a file without agent notes', () => {
    harness.notes = [note('c', 'src/b.ts')]
    const { container } = render(<AgentNoteFileBadge filePath="src/a.ts" />)
    expect(container.textContent).toBe('')
  })
})
