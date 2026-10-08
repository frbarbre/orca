import type { DiffComment } from './diff-comment-types'
import { formatDiffComment } from './diff-comments-format'

// Fork: these sentences make agents answer in Orca's diff with `orca notes add`, which shows as a bot note.

const ADD_COMMAND = 'orca notes add --file <path> --line <n> [--end-line <n>] --body "<text>"'

export const NOTES_AGENT_NOTE_INSTRUCTION = `When you have addressed a note, reply to it saying what you did and why: orca notes reply --id <note id> --body "<text>". Skip this if the orca command is not available.`

export const REVIEW_AGENT_NOTE_INSTRUCTION = `Also leave each finding as an agent note on its lines so it shows in the diff: ${ADD_COMMAND}. Skip this if the orca command is not available.`

export function githubCommentAgentNoteInstruction(url: string | undefined): string {
  return `When you have addressed a review comment, leave an agent note on the lines you changed saying what you did, linked to that comment: ${ADD_COMMAND} --github-comment ${url ?? '<comment url>'}. Skip this if the orca command is not available.`
}

function threadHistory(earlier: readonly DiffComment[]): string {
  const lines = earlier.map(
    (message) => `- ${message.agentAuthor?.name ?? 'User'}: ${JSON.stringify(message.body)}`
  )
  return ['Earlier in this thread:', ...lines].join('\n')
}

/** `earlierInThread` returns the thread messages before a follow-up note, oldest first. */
export function formatDiffCommentsForAgent(
  comments: readonly DiffComment[],
  earlierInThread?: (comment: DiffComment) => readonly DiffComment[]
): string {
  const notes = comments.map((comment) => {
    const earlier = comment.replyToNoteId ? (earlierInThread?.(comment) ?? []) : []
    return [
      formatDiffComment(comment),
      ...(earlier.length > 0 ? [threadHistory(earlier)] : []),
      `Note id: ${comment.id}`
    ].join('\n')
  })
  return `${notes.join('\n\n')}\n\n${NOTES_AGENT_NOTE_INSTRUCTION}`
}
