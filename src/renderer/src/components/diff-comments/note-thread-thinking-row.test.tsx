// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { NoteThread } from './agent-note-replies-list'

const state = vi.hoisted(() => ({
  tabsByWorktree: { 'wt-1': [{ id: 'tab-1' }] },
  agentStatusByPaneKey: {
    'tab-1:leaf-1': { state: 'working', agentType: 'claude', prompt: '', updatedAt: 1 }
  } as Record<string, unknown>,
  markDiffCommentAnswered: vi.fn()
}))

vi.mock('@/store', () => {
  const useAppStore = (selector: (s: typeof state) => unknown): unknown => selector(state)
  useAppStore.getState = () => state
  return { useAppStore }
})
vi.mock('@/lib/send-notes-to-best-agent', () => ({ sendNotesToBestAgent: vi.fn() }))

afterEach(cleanup)

const root: DiffComment = {
  id: 'n1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  lineNumber: 3,
  body: 'Note',
  createdAt: 1,
  side: 'modified',
  agentAuthor: { kind: 'agent', name: 'Claude Code' }
}

describe('NoteThread while a question waits for its answer', () => {
  it('shows the answering agent thinking', () => {
    const question = {
      ...root,
      id: 'q1',
      agentAuthor: undefined,
      sentAt: 2,
      sentToPaneKey: 'tab-1:leaf-1'
    }
    render(<NoteThread root={root} replies={[question]} worktreeId="wt-1" onDelete={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Claude is thinking…')
  })

  it('shows nothing once the agent has answered', () => {
    render(<NoteThread root={root} replies={[]} worktreeId="wt-1" onDelete={vi.fn()} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('marks an old question answered when its tab has since moved on to other work', () => {
    state.agentStatusByPaneKey['tab-1:leaf-1'] = {
      state: 'working',
      agentType: 'claude',
      prompt: '',
      updatedAt: 1,
      stateHistory: [{ state: 'done', prompt: '', startedAt: 7 }]
    } as never
    const question = {
      ...root,
      id: 'q1',
      agentAuthor: undefined,
      sentAt: 2,
      sentToPaneKey: 'tab-1:leaf-1'
    }
    render(<NoteThread root={root} replies={[question]} worktreeId="wt-1" onDelete={vi.fn()} />)

    expect(screen.queryByRole('status')).toBeNull()
    expect(state.markDiffCommentAnswered).toHaveBeenCalledWith('wt-1', 'q1', 7)
  })
})
