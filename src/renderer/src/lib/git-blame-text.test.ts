import { describe, expect, it } from 'vitest'
import { blameHoverMarkdown, blameInlineText, gitBlameSettings, timeAgo } from './git-blame-text'

const NOW = Date.UTC(2026, 9, 9, 12, 0, 0)
const SECOND = 1000
const commit = {
  sha: '3f2a9c1e5b7d4a6c8e0f1a2b3c4d5e6f7a8b9c0d',
  summary: 'feat: paste between pages (#3339)',
  authorName: 'Frederik Barbre',
  authorEmail: 'fba@flowbase.io',
  authorTime: (NOW - 2 * 86_400 * SECOND) / SECOND,
  committerName: 'GitHub',
  isCurrentUser: true
}
const committed = { uncommitted: false as const, commit }
const links = {
  commitUrl: `https://github.com/flowbase/flowbase/commit/${commit.sha}`,
  pullRequest: {
    number: 3339,
    title: 'feat: paste between pages',
    url: 'https://github.com/flowbase/flowbase/pull/3339'
  }
}

function commandArgs(markdown: string, command: string): unknown {
  const match = markdown.match(new RegExp(`\\(command:${command}\\?([^)]+)\\)`))
  return match ? JSON.parse(decodeURIComponent(match[1])) : null
}

describe('gitBlameSettings', () => {
  it('is on, with "You" for my commits, until switched off', () => {
    expect(gitBlameSettings(null)).toEqual({ enabled: true, youForMyCommits: true })
    expect(gitBlameSettings({ gitBlame: { enabled: false } })).toEqual({
      enabled: false,
      youForMyCommits: true
    })
    expect(gitBlameSettings({ gitBlame: { youForMyCommits: false } })).toEqual({
      enabled: true,
      youForMyCommits: false
    })
  })
})

describe('timeAgo', () => {
  it('says roughly how long ago, like the Git Blame extension', () => {
    const ago = (ms: number): string => timeAgo((NOW - ms) / SECOND, NOW)
    expect(ago(10 * SECOND)).toBe('just now')
    expect(ago(5 * 60 * SECOND)).toBe('5 minutes ago')
    expect(ago(60 * 60 * SECOND)).toBe('1 hour ago')
    expect(ago(2 * 86_400 * SECOND)).toBe('2 days ago')
    expect(ago(65 * 86_400 * SECOND)).toBe('2 months ago')
    expect(ago(800 * 86_400 * SECOND)).toBe('2 years ago')
  })
})

describe('blameInlineText', () => {
  it('names the author, when, and what the commit was', () => {
    expect(blameInlineText(committed, { youForMyCommits: false, now: NOW })).toBe(
      'Frederik Barbre, 2 days ago • feat: paste between pages (#3339)'
    )
  })

  it('says "You" for my own commits when that is on', () => {
    expect(blameInlineText(committed, { youForMyCommits: true, now: NOW })).toBe(
      'You, 2 days ago • feat: paste between pages (#3339)'
    )
    const theirs = { uncommitted: false as const, commit: { ...commit, isCurrentUser: false } }
    expect(blameInlineText(theirs, { youForMyCommits: true, now: NOW })).toMatch(/^Frederik Barbre/)
  })

  it('says a line that is not committed yet is an uncommitted change', () => {
    expect(blameInlineText({ uncommitted: true }, { youForMyCommits: true, now: NOW })).toBe(
      'You • Uncommitted change'
    )
  })
})

describe('blameHoverMarkdown', () => {
  it('shows the PR and commit with GitHub links and the actions', () => {
    const markdown = blameHoverMarkdown(committed, links, { youForMyCommits: false, now: NOW })

    expect(markdown).toContain('Frederik Barbre')
    expect(markdown).toContain('2 days ago')
    expect(markdown).toContain('#3339 feat: paste between pages')
    expect(commandArgs(markdown, 'orca.gitBlame.openUrl')).toEqual([links.pullRequest.url])
    expect(markdown).toContain('3f2a9c1e')
    expect(commandArgs(markdown, 'orca.gitBlame.copyHash')).toEqual([commit.sha])
    expect(commandArgs(markdown, 'orca.gitBlame.showCommit')).toEqual([commit.sha])
  })

  it('escapes the commit summary so it renders as text', () => {
    const starred = {
      uncommitted: false as const,
      commit: { ...commit, summary: 'fix *all* [links]' }
    }
    const markdown = blameHoverMarkdown(starred, null, { youForMyCommits: false, now: NOW })
    expect(markdown).toContain('fix \\*all\\* \\[links\\]')
  })

  it('still shows the commit while the GitHub links load or when there are none', () => {
    const markdown = blameHoverMarkdown(committed, null, { youForMyCommits: false, now: NOW })
    expect(markdown).toContain('3f2a9c1e')
    expect(commandArgs(markdown, 'orca.gitBlame.openUrl')).toBeNull()
  })

  it('explains an uncommitted line', () => {
    expect(
      blameHoverMarkdown({ uncommitted: true }, null, { youForMyCommits: true, now: NOW })
    ).toContain('Uncommitted change')
  })
})
