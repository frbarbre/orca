import { describe, expect, it } from 'vitest'
import { isGitHubLogin, parseGitHubUserProfile } from './github-user-profile'

describe('parseGitHubUserProfile', () => {
  it('reads what the users endpoint says about someone', () => {
    expect(
      parseGitHubUserProfile({
        login: 'madsenmm',
        name: 'Mads Madsen',
        avatar_url: 'https://avatars/madsenmm',
        html_url: 'https://github.com/madsenmm',
        bio: 'Frontend',
        company: '@flowbase',
        location: 'Copenhagen',
        type: 'User'
      })
    ).toEqual({
      login: 'madsenmm',
      name: 'Mads Madsen',
      avatarUrl: 'https://avatars/madsenmm',
      url: 'https://github.com/madsenmm',
      bio: 'Frontend',
      company: '@flowbase',
      location: 'Copenhagen',
      isBot: false
    })
  })

  it('reads a sparse profile, and nothing from a non-profile', () => {
    expect(parseGitHubUserProfile({ login: 'linear', type: 'Bot' })).toMatchObject({
      login: 'linear',
      name: null,
      bio: null,
      isBot: true
    })
    expect(parseGitHubUserProfile({ message: 'Not Found' })).toBeNull()
  })
})

describe('isGitHubLogin', () => {
  it('accepts a GitHub login and refuses anything else', () => {
    expect(isGitHubLogin('madsen-mm')).toBe(true)
    expect(isGitHubLogin('a')).toBe(true)
    expect(isGitHubLogin('-lead')).toBe(false)
    expect(isGitHubLogin('../repos')).toBe(false)
    expect(isGitHubLogin('x'.repeat(40))).toBe(false)
  })
})
