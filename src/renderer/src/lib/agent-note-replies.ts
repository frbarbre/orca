import type { DiffComment } from '../../../shared/diff-comment-types'
import type { DecoratedDiffComment } from '@/components/diff-comments/decorated-diff-comment'

// Fork: a reply sits inside the note it answers, so the answer keeps its question beside it.
export function withAgentReplies(
  userNotes: readonly DiffComment[],
  agentNotes: readonly DiffComment[]
): DecoratedDiffComment[] {
  const userNoteIds = new Set(userNotes.map((note) => note.id))
  const repliesByNote = new Map<string, DiffComment[]>()
  const standalone: DiffComment[] = []
  for (const note of agentNotes) {
    if (note.replyToNoteId && userNoteIds.has(note.replyToNoteId)) {
      repliesByNote.set(note.replyToNoteId, [
        ...(repliesByNote.get(note.replyToNoteId) ?? []),
        note
      ])
    } else {
      standalone.push(note)
    }
  }
  return [
    ...userNotes.map((note) => {
      const agentReplies = repliesByNote.get(note.id)
      return agentReplies ? { ...note, agentReplies } : note
    }),
    ...standalone
  ]
}
