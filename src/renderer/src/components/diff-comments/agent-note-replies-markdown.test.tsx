// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import { NoteThread } from './agent-note-replies-list'

vi.mock('@/store', () => {
  const state = { tabsByWorktree: {}, agentStatusByPaneKey: {} }
  return {
    useAppStore: Object.assign((select: (s: typeof state) => unknown) => select(state), {
      getState: () => state
    })
  }
})
vi.mock('@/lib/send-notes-to-best-agent', () => ({ sendNotesToBestAgent: vi.fn() }))
vi.mock('@/components/composer/Composer', async () => ({
  Composer: (await import('@/components/composer/composer-test-double')).ComposerTestDouble
}))

afterEach(cleanup)

const BODY = 'Repro with `addStop`.\n\n- **Bug:** stop stays blue.\n- Swap the kit.'

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

function renderReply(reply: Partial<DiffComment>) {
  return render(
    <NoteThread
      root={root}
      replies={[{ ...root, id: 'r1', body: BODY, ...reply }]}
      worktreeId="wt-1"
      onDelete={vi.fn()}
    />
  )
}

describe('NoteThread replies', () => {
  it('reads an agent reply as markdown', () => {
    const { container } = renderReply({})
    expect(container.querySelector('.orca-diff-comment-body code')?.textContent).toBe('addStop')
    expect(container.querySelectorAll('.orca-diff-comment-body li')).toHaveLength(2)
    expect(container.querySelector('.orca-diff-comment-body strong')?.textContent).toBe('Bug:')
  })

  it("keeps the user's own reply as the text they typed", () => {
    const { container } = renderReply({ agentAuthor: undefined })
    expect(container.querySelector('.orca-diff-comment-body')?.textContent).toBe(BODY)
  })
})
