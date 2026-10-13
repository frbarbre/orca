import { useAppStore } from '@/store'
import { removeAgentNote, selectWorktreeAgentNotes } from '@/lib/agent-notes'
import { selectWorktreeDiffComments } from '@/store/worktree-diff-comments-selector'

type ThreadNote = { id: string; replyToNoteId?: string }

/** The note and, when it is a thread root, every reply to it; replies come before the root. */
export function collectNoteThread(
  id: string,
  userNotes: readonly ThreadNote[],
  agentNotes: readonly ThreadNote[]
): { userIds: string[]; agentIds: string[] } {
  const replyIds = (notes: readonly ThreadNote[]): string[] =>
    notes.filter((note) => note.replyToNoteId === id).map((note) => note.id)
  const isUserNote = userNotes.some((note) => note.id === id)
  return {
    userIds: [...replyIds(userNotes), ...(isUserNote ? [id] : [])],
    agentIds: [...replyIds(agentNotes), ...(isUserNote ? [] : [id])]
  }
}

// Fork: deleting a thread's root takes its replies with it, from both stores, instead of leaving
// them orphaned under a note that is gone.
export async function deleteNoteThread(worktreeId: string, id: string): Promise<void> {
  const state = useAppStore.getState()
  const { userIds, agentIds } = collectNoteThread(
    id,
    selectWorktreeDiffComments(state, worktreeId) ?? [],
    selectWorktreeAgentNotes(state, worktreeId)
  )
  for (const userId of userIds) {
    await state.deleteDiffComment(worktreeId, userId)
  }
  for (const agentId of agentIds) {
    await removeAgentNote(worktreeId, agentId)
  }
}
