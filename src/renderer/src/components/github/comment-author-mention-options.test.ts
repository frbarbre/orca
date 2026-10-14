import { describe, expect, it } from 'vitest'
import type { PRComment } from '../../../../shared/github/comment-types'
import { withCommentAuthorMentionOptions } from './comment-author-mention-options'

function comment(author: string, extras: Partial<PRComment> = {}): PRComment {
  return { author, authorAvatarUrl: `https://avatars/${author}`, ...extras } as PRComment
}

describe('withCommentAuthorMentionOptions', () => {
  it('adds commenters, bots included, after the members without duplicating anyone', () => {
    const members = [{ login: 'frbarbre', source: 'Member' }]
    const options = withCommentAuthorMentionOptions(members, [
      comment('linear', { isBot: true }),
      comment('FrBarbre'),
      comment('madsenmm'),
      comment('linear[bot]', { isBot: true }),
      comment('ghost')
    ])
    expect(options.map((option) => [option.login, option.source])).toEqual([
      ['frbarbre', 'Member'],
      ['linear', 'App'],
      ['madsenmm', 'Commenter']
    ])
  })
})
