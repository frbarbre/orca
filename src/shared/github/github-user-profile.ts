export type GitHubUserProfile = {
  login: string
  name: string | null
  avatarUrl: string | null
  url: string
  bio: string | null
  company: string | null
  location: string | null
  isBot: boolean
}

const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/

export function isGitHubLogin(value: string): boolean {
  return GITHUB_LOGIN_PATTERN.test(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseGitHubUserProfile(payload: unknown): GitHubUserProfile | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const record = payload as Record<string, unknown>
  const login = text(record.login)
  if (!login) {
    return null
  }
  return {
    login,
    name: text(record.name),
    avatarUrl: text(record.avatar_url),
    url: text(record.html_url) ?? `https://github.com/${login}`,
    bio: text(record.bio),
    company: text(record.company),
    location: text(record.location),
    isBot: record.type === 'Bot'
  }
}
