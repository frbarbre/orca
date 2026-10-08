import type { DiffComment } from '../../../shared/diff-comment-types'
import type { DecoratedDiffComment } from '@/components/diff-comments/decorated-diff-comment'

// Fork: a thread is its first note (the user's or an agent's) plus every note that replies to it,
// in time order, so an answer keeps its question beside it.
export function buildNoteThreads(
  userNotes: readonly DiffComment[],
  agentNotes: readonly DiffComment[]
): DecoratedDiffComment[] {
  const all = [...userNotes, ...agentNotes]
  const ids = new Set(all.map((note) => note.id))
  const isReply = (note: DiffComment): boolean =>
    note.replyToNoteId !== undefined && ids.has(note.replyToNoteId)
  const repliesByRoot = new Map<string, DiffComment[]>()
  for (const note of all) {
    if (isReply(note) && note.replyToNoteId) {
      repliesByRoot.set(note.replyToNoteId, [
        ...(repliesByRoot.get(note.replyToNoteId) ?? []),
        note
      ])
    }
  }
  return all
    .filter((note) => !isReply(note))
    .map((note) => {
      const replies = repliesByRoot.get(note.id)
      return replies
        ? { ...note, threadReplies: [...replies].sort((a, b) => a.createdAt - b.createdAt) }
        : note
    })
}
