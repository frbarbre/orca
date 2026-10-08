// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../../../shared/diff-comment-types'
import { AgentNotesShelf } from './agent-notes-shelf'

const harness = vi.hoisted(() => {
  const state: { notes: DiffComment[]; removeAgentNote: ReturnType<typeof vi.fn> } = {
    notes: [],
    removeAgentNote: vi.fn()
  }
  return state
})

vi.mock('@/lib/agent-notes', () => ({
  useWorktreeAgentNotes: () => harness.notes,
  removeAgentNote: harness.removeAgentNote
}))

function agentNote(id: string, filePath: string, lineNumber: number): DiffComment {
  return {
    id,
    worktreeId: 'wt-1',
    filePath,
    lineNumber,
    body: `Resolved on ${lineNumber}`,
    createdAt: 1,
    side: 'modified',
    agentAuthor: { kind: 'agent', name: 'Codex' }
  }
}

describe('AgentNotesShelf', () => {
  beforeEach(() => {
    harness.removeAgentNote.mockReset()
    harness.notes = [agentNote('a1', 'src/a.ts', 3), agentNote('a2', 'src/b.ts', 9)]
  })

  afterEach(() => {
    cleanup()
  })

  it('stays out of the way when no agent left a note', () => {
    harness.notes = []
    const { container } = render(<AgentNotesShelf worktreeId="wt-1" onOpenNote={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('lists agent notes under a bot header, opens one, and removes one', () => {
    const onOpenNote = vi.fn()
    render(<AgentNotesShelf worktreeId="wt-1" onOpenNote={onOpenNote} />)

    expect(screen.getByText('Agent notes')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.queryByText('Resolved on 3')).toBeNull()

    fireEvent.click(screen.getByText('Agent notes'))
    expect(screen.getByTestId('agent-notes-shelf-list').className).toContain('max-h-')
    fireEvent.click(screen.getByText('Resolved on 3'))
    expect(onOpenNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete note on line 9' }))
    expect(harness.removeAgentNote).toHaveBeenCalledWith('wt-1', 'a2')

    fireEvent.click(screen.getByText('Agent notes'))
    expect(screen.queryByText('Resolved on 3')).toBeNull()
  })
})
