// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { DiffCommentCard } from './DiffCommentCard'
import { NoteThread } from './agent-note-replies-list'

const writeClipboardText = vi.fn(async () => undefined)

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/store', () => {
  const state = { tabsByWorktree: {}, agentStatusByPaneKey: {} }
  return {
    useAppStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
      getState: () => state
    })
  }
})
vi.mock('@/lib/send-notes-to-best-agent', () => ({ sendNotesToBestAgent: vi.fn() }))

beforeEach(() => {
  writeClipboardText.mockClear()
  vi.stubGlobal('api', { ui: { writeClipboardText } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const root: DiffComment = {
  id: 'n1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  lineNumber: 3,
  body: 'The **root** note',
  createdAt: 1,
  side: 'modified',
  agentAuthor: { kind: 'agent', name: 'Claude Code' }
}

describe('copying a note', () => {
  it('copies the note itself as written', () => {
    render(
      <TooltipProvider>
        <DiffCommentCard lineNumber={3} body="The **root** note" agentName="Claude Code" />
      </TooltipProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))
    expect(writeClipboardText).toHaveBeenCalledWith('The **root** note')
  })

  it('copies one reply, not the thread it is in', () => {
    const replies: DiffComment[] = [
      { ...root, id: 'r1', body: 'First reply', agentAuthor: undefined },
      { ...root, id: 'r2', body: 'Second `reply`' }
    ]
    render(<NoteThread root={root} replies={replies} worktreeId="wt-1" onDelete={vi.fn()} />)

    const buttons = screen.getAllByRole('button', { name: 'Copy message' })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[1]!)
    expect(writeClipboardText).toHaveBeenCalledWith('Second `reply`')
  })
})
