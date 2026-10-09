import type { GitBlameLine, GitBlameLinks } from '../../../shared/git-blame'
import { translate } from '@/i18n/i18n'

type BlameTextOptions = { youForMyCommits: boolean; now: number }

// Why `!== false`: settings are stored shallowly, so an unset switch means on.
export function gitBlameSettings(
  settings: { gitBlame?: { enabled?: boolean; youForMyCommits?: boolean } } | null
): { enabled: boolean; youForMyCommits: boolean } {
  return {
    enabled: settings?.gitBlame?.enabled !== false,
    youForMyCommits: settings?.gitBlame?.youForMyCommits !== false
  }
}

const UNITS: [unit: 'year' | 'month' | 'day' | 'hour' | 'minute', seconds: number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60]
]

export function timeAgo(unixSeconds: number, now: number): string {
  const elapsed = Math.max(0, now / 1000 - unixSeconds)
  for (const [unit, seconds] of UNITS) {
    const count = Math.floor(elapsed / seconds)
    if (count >= 1) {
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&')
}

function commandLink(label: string, command: string, arg: string): string {
  return `[${escapeMarkdown(label)}](command:${command}?${encodeURIComponent(JSON.stringify([arg]))})`
}

function authorLabel(
  commit: { authorName: string; isCurrentUser: boolean },
  { youForMyCommits }: BlameTextOptions
): string {
  return youForMyCommits && commit.isCurrentUser
    ? translate('auto.lib.gitBlame.you', 'You')
    : commit.authorName
}

export function blameInlineText(blame: GitBlameLine, options: BlameTextOptions): string {
  if (blame.uncommitted) {
    return `${translate('auto.lib.gitBlame.you', 'You')} • ${translate('auto.lib.gitBlame.uncommitted', 'Uncommitted change')}`
  }
  const { commit } = blame
  return `${authorLabel(commit, options)}, ${timeAgo(commit.authorTime, options.now)} • ${commit.summary}`
}

export function blameHoverMarkdown(
  blame: GitBlameLine,
  links: GitBlameLinks | null,
  options: BlameTextOptions
): string {
  if (blame.uncommitted) {
    return `**${translate('auto.lib.gitBlame.uncommitted', 'Uncommitted change')}**\n\n${translate(
      'auto.lib.gitBlame.uncommittedDetail',
      'This line has changes that are not committed yet.'
    )}`
  }
  const { commit } = blame
  const shortSha = commit.sha.slice(0, 8)
  const date = new Date(commit.authorTime * 1000).toLocaleString()
  const lines = [
    `**${escapeMarkdown(authorLabel(commit, options))}** · ${timeAgo(commit.authorTime, options.now)} (${escapeMarkdown(date)})`,
    escapeMarkdown(commit.summary)
  ]
  if (links?.pullRequest) {
    const { number, title, url } = links.pullRequest
    lines.push(
      `${translate('auto.lib.gitBlame.pullRequest', 'Pull request')} ${commandLink(`#${number} ${title}`, 'orca.gitBlame.openUrl', url)}`
    )
  }
  const commitLabel = `${translate('auto.lib.gitBlame.commit', 'Commit')} ${
    links?.commitUrl
      ? commandLink(shortSha, 'orca.gitBlame.openUrl', links.commitUrl)
      : `\`${shortSha}\``
  }`
  const committer =
    commit.committerName && commit.committerName !== commit.authorName
      ? ` · ${translate('auto.lib.gitBlame.committedBy', 'committed by')} ${escapeMarkdown(commit.committerName)}`
      : ''
  lines.push(`${commitLabel}${committer}`)
  lines.push(
    [
      commandLink(
        translate('auto.lib.gitBlame.showCommit', 'Show commit'),
        'orca.gitBlame.showCommit',
        commit.sha
      ),
      commandLink(
        translate('auto.lib.gitBlame.copyHash', 'Copy hash'),
        'orca.gitBlame.copyHash',
        commit.sha
      )
    ].join(' · ')
  )
  return lines.join('\n\n')
}
