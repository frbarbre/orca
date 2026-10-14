import type { PRComment } from '../../../../shared/github/comment-types'
import type { MentionOption } from '@/components/pull-request-page/page-types'
import { translate } from '@/i18n/i18n'

// Why commenters: apps such as Linear can be mentioned but are never assignable, so the
// pull request's own conversation is the only place they surface.
export function withCommentAuthorMentionOptions(
  options: readonly MentionOption[],
  comments: readonly PRComment[]
): MentionOption[] {
  const seen = new Set(options.map((option) => option.login.toLowerCase()))
  const merged = [...options]
  for (const comment of comments) {
    const login = comment.author.replace(/\[bot\]$/i, '')
    const key = login.toLowerCase()
    if (!login || key === 'ghost' || seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push({
      login,
      avatarUrl: comment.authorAvatarUrl,
      source: comment.isBot
        ? translate('auto.components.github.mentions.app', 'App')
        : translate('auto.components.github.mentions.commenter', 'Commenter')
    })
  }
  return merged
}
