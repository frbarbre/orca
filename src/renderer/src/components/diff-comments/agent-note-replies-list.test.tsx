// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { NoteThread } from './agent-note-replies-list'

vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ addDiffComment: vi.fn() }) } }))

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
  let scrollHeight = 40

  beforeEach(() => {
    scrollHeight = 40
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(
      () => scrollHeight
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('grows with what is typed, up to a cap', () => {
    render(<NoteThread root={root} replies={[]} worktreeId="wt-1" onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    const textarea = screen.getByPlaceholderText('Ask a follow-up…')

    scrollHeight = 120
    fireEvent.change(textarea, { target: { value: 'line 1\nline 2\nline 3\nline 4' } })
    expect(textarea.style.height).toBe('120px')

    scrollHeight = 900
    fireEvent.change(textarea, { target: { value: 'a very long follow-up' } })
    expect(textarea.style.height).toBe('240px')
  })
})
