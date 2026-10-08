import { randomUUID } from 'node:crypto'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import {
  AgentNoteAdd,
  AgentNoteList,
  AgentNoteRemove
} from '../../../../shared/rpc-contract/agent-note-params'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { defineMethod } from '../core'

const writeChains = new Map<string, Promise<unknown>>()

// Why: each write reads the stored list first, so two concurrent writes to one worktree must not interleave.
function serializeForWorktree<T>(worktreeId: string, write: () => Promise<T>): Promise<T> {
  const previous = writeChains.get(worktreeId) ?? Promise.resolve()
  const next = previous.then(write, write)
  const settled = next.then(
    () => undefined,
    () => undefined
  )
  writeChains.set(worktreeId, settled)
  void settled.then(() => {
    if (writeChains.get(worktreeId) === settled) {
      writeChains.delete(worktreeId)
    }
  })
  return next
}

async function updateAgentNotes(
  runtime: OrcaRuntimeService,
  selector: string,
  change: (notes: DiffComment[], worktreeId: string) => DiffComment[]
): Promise<{ before: DiffComment[]; after: DiffComment[] }> {
  const { id } = await runtime.showManagedWorktree(selector)
  return serializeForWorktree(id, async () => {
    const before = (await runtime.showManagedWorktree(`id:${id}`)).agentNotes ?? []
    const after = change(before, id)
    if (after !== before) {
      await runtime.updateManagedWorktreeMeta(`id:${id}`, { agentNotes: after })
    }
    return { before, after }
  })
}

export const AGENT_NOTE_METHODS = [
  defineMethod({
    name: 'agentNote.add',
    params: AgentNoteAdd,
    handler: async (params, { runtime }) => {
      let note: DiffComment | null = null
      await updateAgentNotes(runtime, params.worktree, (notes, worktreeId) => {
        note = {
          id: randomUUID(),
          worktreeId,
          filePath: params.filePath,
          ...(params.startLine !== undefined && params.startLine !== params.line
            ? { startLine: params.startLine }
            : {}),
          lineNumber: params.line,
          body: params.body,
          createdAt: Date.now(),
          side: 'modified',
          agentAuthor: { kind: 'agent', name: params.agent }
        }
        return [...notes, note]
      })
      return { note }
    }
  }),
  defineMethod({
    name: 'agentNote.list',
    params: AgentNoteList,
    handler: async (params, { runtime }) => {
      const worktree = await runtime.showManagedWorktree(params.worktree)
      return { userNotes: worktree.diffComments ?? [], agentNotes: worktree.agentNotes ?? [] }
    }
  }),
  defineMethod({
    name: 'agentNote.remove',
    params: AgentNoteRemove,
    handler: async (params, { runtime }) => {
      const { before, after } = await updateAgentNotes(runtime, params.worktree, (notes) =>
        notes.some((note) => note.id === params.id)
          ? notes.filter((note) => note.id !== params.id)
          : notes
      )
      return { removed: after.length < before.length }
    }
  })
]
