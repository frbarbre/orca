import { describe, expect, it } from 'vitest'
import { composerMentionSuggestions } from './composer-mention-suggestions'

const person = (login: string) => ({ login, source: 'Member' })

describe('composerMentionSuggestions', () => {
  it('offers the people that match, then the workspace files', () => {
    expect(
      composerMentionSuggestions({
        query: 'mad',
        people: [person('madsenmm'), person('zahlio')],
        files: ['apps/madness.ts']
      }).map((option) => option.login)
    ).toEqual(['madsenmm', 'apps/madness.ts'])
  })

  it('offers only files once the query is a path no login can be', () => {
    expect(
      composerMentionSuggestions({
        query: 'apps/m',
        people: [person('madsenmm')],
        files: ['apps/madness.ts']
      }).map((option) => option.login)
    ).toEqual(['apps/madness.ts'])
  })

  it('marks file suggestions as files', () => {
    const [file] = composerMentionSuggestions({ query: '', people: [], files: ['README.md'] })
    expect(file?.isFile).toBe(true)
  })
})
