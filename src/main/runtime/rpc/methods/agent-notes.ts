import { randomUUID } from 'node:crypto'
import type { DiffComment } from '../../../../shared/diff-comment-types'
import {
  AgentNoteAdd,
  AgentNoteList,
  AgentNoteRemove,
  AgentNoteReply
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
    permission: 'workspace',
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
          agentAuthor: { kind: 'agent', name: params.agent },
          ...(params.githubCommentUrl ? { githubCommentUrl: params.githubCommentUrl } : {})
        }
        return [...notes, note]
      })
      return { note }
    }
  }),
  defineMethod({
    name: 'agentNote.reply',
    permission: 'workspace',
    params: AgentNoteReply,
    handler: async (params, { runtime }) => {
      const worktree = await runtime.showManagedWorktree(params.worktree)
      const allNotes = [...(worktree.diffComments ?? []), ...(worktree.agentNotes ?? [])]
      const target = allNotes.find((comment) => comment.id === params.noteId)
      if (!target) {
        throw new Error(`No note ${params.noteId} in this worktree; run orca notes list.`)
      }
      // Why the root: a thread is its first note plus everything that replies to it, at one level.
      const parent =
        (target.replyToNoteId && allNotes.find((comment) => comment.id === target.replyToNoteId)) ||
        target
      let note: DiffComment | null = null
      await updateAgentNotes(runtime, `id:${worktree.id}`, (notes, worktreeId) => {
        note = {
          id: randomUUID(),
          worktreeId,
          filePath: parent.filePath,
          ...(parent.startLine !== undefined ? { startLine: parent.startLine } : {}),
          lineNumber: parent.lineNumber,
          body: params.body,
          createdAt: Date.now(),
          side: 'modified',
          agentAuthor: { kind: 'agent', name: params.agent },
          replyToNoteId: parent.id
        }
        return [...notes, note]
      })
      return { note }
    }
  }),
  defineMethod({
    name: 'agentNote.list',
    permission: 'workspace',
    params: AgentNoteList,
    handler: async (params, { runtime }) => {
      const worktree = await runtime.showManagedWorktree(params.worktree)
      return { userNotes: worktree.diffComments ?? [], agentNotes: worktree.agentNotes ?? [] }
    }
  }),
  defineMethod({
    name: 'agentNote.remove',
    permission: 'workspace',
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
