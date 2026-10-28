// Persist line review notes on WorktreeMeta for existing orca-data.json storage and later agent handoff.
export type DiffCommentSource = 'diff' | 'markdown'
export type DiffReviewScope = 'unstaged' | 'staged' | 'branch'

export type MobileDiffReviewFileState = {
  key: string
  filePath: string
  oldPath?: string
  scope: DiffReviewScope
  lastOpenedAt?: number
  lastSeenDiffIdentity?: string
  reviewedAt?: number
  reviewDiffIdentity?: string
}

export type MobileDiffReviewState = {
  version: 1
  updatedAt?: number
  completedAt?: number
  files: Record<string, MobileDiffReviewFileState>
}

export type DiffCommentAgentAuthor = { kind: 'agent'; name: string }

export type DiffComment = {
  id: string
  /** Fork: present only on notes an agent left through `orca notes add` (stored in WorktreeMeta.agentNotes). */
  agentAuthor?: DiffCommentAgentAuthor
  /** Fork: the GitHub review comment an agent note answers. */
  githubCommentUrl?: string
  /** Fork: the user's diff note this agent note replies to. */
  replyToNoteId?: string
  worktreeId: string
  filePath: string
  /** Undefined means a legacy diff note. */
  source?: DiffCommentSource
  /** Exact text selected when creating a markdown note, when available. */
  selectedText?: string
  /** Inclusive range start. Must be <= lineNumber when present. */
  startLine?: number
  lineNumber: number
  body: string
  createdAt: number
  updatedAt?: number
  /** Set after the note has been handed to an agent. Edits clear it. */
  sentAt?: number
  /** Fork: the agent pane it was handed to, when known, to show that agent working on a reply. */
  sentToPaneKey?: string
  /** Fork: when the agent it was sent to finished a turn after it; stops the thinking row. */
  answeredAt?: number
  scope?: DiffReviewScope
  oldPath?: string
  diffIdentity?: string
  // Reserved for future "comments on the original side" — always 'modified' in v1.
  side: 'modified'
}
