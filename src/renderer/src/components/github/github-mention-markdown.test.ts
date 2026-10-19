import { describe, expect, it } from 'vitest'
import { splitGitHubMentions } from './github-mention-markdown'

const mention = (login: string) => ({
  type: 'githubMention',
  data: { hName: 'span', hProperties: { dataGithubMention: login } },
  children: [{ type: 'text', value: `@${login}` }]
})

describe('splitGitHubMentions', () => {
  it('finds each @login in a line of text', () => {
    expect(splitGitHubMentions('@madsenmm Remember, cc @zahlio.')).toEqual([
      mention('madsenmm'),
      { type: 'text', value: ' Remember, cc ' },
      mention('zahlio'),
      { type: 'text', value: '.' }
    ])
  })

  it('leaves email addresses, file paths and plain text alone', () => {
    for (const text of [
      'mail me@example.com',
      'see @apps/frontend/a.ts',
      'read @CLAUDE.md',
      'no one'
    ]) {
      expect(splitGitHubMentions(text)).toEqual([{ type: 'text', value: text }])
    }
  })
})
