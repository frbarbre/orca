import '../unused-default-rpc-methods.test-fixture'
import { describe, expect, it } from 'vitest'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { RpcDispatcher } from '../dispatcher'
import { AGENT_NOTE_METHODS } from './agent-notes'

type StoredWorktree = { id: string; diffComments: DiffComment[]; agentNotes?: DiffComment[] }

function createRuntime(initial: StoredWorktree) {
  let stored = initial
  const runtime = {
    getRuntimeId: () => 'test-runtime',
    showManagedWorktree: async (selector: string) => {
      if (selector !== `id:${stored.id}`) {
        throw new Error('selector_not_found')
      }
      return { ...stored }
    },
    updateManagedWorktreeMeta: async (
      _selector: string,
      updates: { agentNotes?: DiffComment[] }
    ) => {
      // Why yield: a real write awaits the store, so a racing add would read the old list here.
      await new Promise((resolve) => setTimeout(resolve, 5))
      stored = { ...stored, ...updates }
      return stored
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers only call the two methods stubbed here.
  const dispatcher = new RpcDispatcher({
    runtime: runtime as unknown as OrcaRuntimeService,
    methods: AGENT_NOTE_METHODS
  })
  let requestId = 0
  const call = async (method: string, params: Record<string, unknown>) =>
    dispatcher.dispatch({ id: `req-${++requestId}`, authToken: 'tok', method, params })
  return { call, stored: () => stored }
}

const userNote: DiffComment = {
  id: 'user-1',
  worktreeId: 'wt-1',
  filePath: 'src/a.ts',
  lineNumber: 3,
  body: 'Please rename this',
  createdAt: 1,
  side: 'modified'
}

describe('agent note RPC methods', () => {
  it('adds an agent-authored note to the worktree and returns it', async () => {
    const { call, stored } = createRuntime({ id: 'wt-1', diffComments: [userNote] })

    const response = await call('agentNote.add', {
      worktree: 'id:wt-1',
      filePath: 'src/a.ts',
      startLine: 3,
      line: 5,
      body: 'Renamed to fetchUser and updated both callers.',
      agent: 'Claude Code'
    })

    expect(response).toMatchObject({ ok: true })
    const [note] = stored().agentNotes ?? []
    expect(note).toMatchObject({
      worktreeId: 'wt-1',
      filePath: 'src/a.ts',
      startLine: 3,
      lineNumber: 5,
      body: 'Renamed to fetchUser and updated both callers.',
      side: 'modified',
      agentAuthor: { kind: 'agent', name: 'Claude Code' }
    })
    expect(note.id).toEqual(expect.any(String))
    expect(stored().diffComments).toEqual([userNote])
  })

  it('keeps both notes when two agents add at the same time', async () => {
    const { call, stored } = createRuntime({ id: 'wt-1', diffComments: [] })

    await Promise.all([
      call('agentNote.add', {
        worktree: 'id:wt-1',
        filePath: 'a.ts',
        line: 1,
        body: 'one',
        agent: 'Codex'
      }),
      call('agentNote.add', {
        worktree: 'id:wt-1',
        filePath: 'b.ts',
        line: 2,
        body: 'two',
        agent: 'Claude Code'
      })
    ])

    expect(
      stored()
        .agentNotes?.map((note) => note.body)
        .sort()
    ).toEqual(['one', 'two'])
  })

  it('lists the user notes and the agent notes separately', async () => {
    const { call } = createRuntime({ id: 'wt-1', diffComments: [userNote] })
    await call('agentNote.add', {
      worktree: 'id:wt-1',
      filePath: 'a.ts',
      line: 1,
      body: 'done',
      agent: 'Codex'
    })

    const response = await call('agentNote.list', { worktree: 'id:wt-1' })

    expect(response).toMatchObject({
      ok: true,
      result: { userNotes: [userNote], agentNotes: [{ body: 'done' }] }
    })
  })

  it('removes an agent note by id', async () => {
    const { call, stored } = createRuntime({ id: 'wt-1', diffComments: [] })
    await call('agentNote.add', {
      worktree: 'id:wt-1',
      filePath: 'a.ts',
      line: 1,
      body: 'done',
      agent: 'Codex'
    })
    const id = stored().agentNotes?.[0]?.id

    const response = await call('agentNote.remove', { worktree: 'id:wt-1', id })

    expect(response).toMatchObject({ ok: true, result: { removed: true } })
    expect(stored().agentNotes).toEqual([])
  })

  it('rejects a range that ends before it starts', async () => {
    const { call, stored } = createRuntime({ id: 'wt-1', diffComments: [] })

    const response = await call('agentNote.add', {
      worktree: 'id:wt-1',
      filePath: 'a.ts',
      startLine: 9,
      line: 4,
      body: 'backwards',
      agent: 'Codex'
    })

    expect(response).toMatchObject({ ok: false })
    expect(stored().agentNotes).toBeUndefined()
  })
})
