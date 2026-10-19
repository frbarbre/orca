/** Who the text is for: an agent, a GitHub conversation, or an issue tracker's comments. */
export type ComposerContext = 'agent' | 'github' | 'tracker'

export type ComposerFeatures = {
  /** `@` suggests the repository's GitHub people. */
  userMentions: boolean
  /** `@` suggests this workspace's files instead, for an agent to read. */
  fileMentionWorktreeId: string | null
  /** Pasted and dropped files upload to GitHub, which makes them public. */
  uploads: boolean
}

/**
 * Fork: the one place that decides what a text box offers, so a feature added for one context
 * reaches every box in it. Markdown, emoji, drafts and the send/close keys are always on.
 */
export function composerFeatures(
  context: ComposerContext,
  worktreeId: string | null
): ComposerFeatures {
  switch (context) {
    case 'agent':
      return { userMentions: false, fileMentionWorktreeId: worktreeId, uploads: false }
    case 'github':
      return { userMentions: true, fileMentionWorktreeId: null, uploads: true }
    case 'tracker':
      return { userMentions: false, fileMentionWorktreeId: null, uploads: false }
  }
}
