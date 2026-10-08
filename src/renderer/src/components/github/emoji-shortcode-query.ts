import {
  searchWorkspaceEmojiShortcodes,
  type WorkspaceEmojiSuggestion
} from '@/lib/workspace-emoji-shortcodes'

// Why two characters, as Slack does: one would open the list on every stray colon.
const SHORTCODE_BEFORE_CARET = /(^|[\s([{,]):([a-z0-9_+-]{2,40})$/i
const MAX_SUGGESTIONS = 30

export function findEmojiShortcodeQuery(
  textBeforeCaret: string
): { query: string; start: number } | null {
  const match = SHORTCODE_BEFORE_CARET.exec(textBeforeCaret)
  if (!match) {
    return null
  }
  const query = match[2]
  return { query: query.toLowerCase(), start: textBeforeCaret.length - query.length - 1 }
}

export function searchCommentEmoji(query: string): WorkspaceEmojiSuggestion[] {
  return searchWorkspaceEmojiShortcodes(query, MAX_SUGGESTIONS)
}
