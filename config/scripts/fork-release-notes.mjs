// Resolves the fork's next version and writes its release notes.
//
// The fork keeps its own version line, because the installed app only offers an update whose
// version is higher than its own, and upstream's package.json version moves at upstream's pace
// — sometimes backwards relative to ours, since a sync lands an older upstream number on a fork
// that has already released past it. So the release version is the fork's previous release plus
// one, and upstream's version rides along in the title: "1.4.233 (Orca 1.4.214)".
//
// Upstream's version is read from package.json, never from its releases: package.json is what
// the code actually is, and upstream routinely bumps it ahead of publishing a release for it.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// GitHub refuses a release body over 125,000 characters. The headroom covers the fork section,
// the headings and the trailing links added after the budget is spent.
export const RELEASE_BODY_BUDGET = 110_000

const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(value) {
  const match = SEMVER_TAG.exec(value.startsWith('v') ? value : `v${value}`)
  return match ? match.slice(1, 4).map(Number) : null
}

export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) {
    throw new Error(`Not a version: ${!a ? left : right}`)
  }
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index]
    }
  }
  return 0
}

function releaseTags(tags) {
  return tags.filter((tag) => SEMVER_TAG.test(tag))
}

/** The version to publish: the override when given, otherwise the newest release plus a patch. */
export function nextForkVersion(existingTags, override) {
  if (override) {
    if (!parseVersion(override)) {
      throw new Error(`Not a version: ${override}`)
    }
    return override.replace(/^v/, '')
  }
  const tags = releaseTags(existingTags).sort(compareVersions)
  const newest = tags.at(-1)
  if (!newest) {
    throw new Error('No earlier fork release to count from; pass a version explicitly.')
  }
  const [major, minor, patch] = parseVersion(newest)
  return `${major}.${minor}.${patch + 1}`
}

/**
 * The release this one follows.
 *
 * Why "strictly below" rather than "the newest": re-running a release reuses its version, and
 * measuring it against itself would produce empty notes.
 */
export function previousForkTag(existingTags, version) {
  const below = releaseTags(existingTags).filter((tag) => compareVersions(tag, version) < 0)
  return below.sort(compareVersions).at(-1) ?? null
}

/** Upstream's published desktop releases in (from, to], newest first. */
export function selectUpstreamReleases(releases, from, to) {
  return releases
    .filter((release) => !release.isPrerelease && SEMVER_TAG.test(release.tagName))
    .filter(
      (release) =>
        compareVersions(release.tagName, from) > 0 && compareVersions(release.tagName, to) <= 0
    )
    .sort((left, right) => compareVersions(right.tagName, left.tagName))
}

/**
 * Nests upstream's own headings under the "### Orca x.y.z" they are quoted beneath.
 *
 * Why: upstream writes its notes with `##` sections, which would otherwise sit level with this
 * release's own "## This fork" and flatten the outline into one long list.
 */
export function demoteHeadings(markdown) {
  return markdown.replace(
    /^(#{1,6}) /gm,
    (_match, hashes) => `${'#'.repeat(Math.min(6, hashes.length + 2))} `
  )
}

export function releaseTitle(version, upstreamVersion) {
  return `${version} (Orca ${upstreamVersion})`
}

function forkSection(forkCommits, repoUrl) {
  if (forkCommits.length === 0) {
    return '## This fork\n\nNo fork changes in this release — it only brings in upstream.\n'
  }
  const lines = forkCommits.map(
    (commit) =>
      `- ${commit.subject} ([\`${commit.sha.slice(0, 7)}\`](${repoUrl}/commit/${commit.sha}))`
  )
  return `## This fork\n\n${lines.join('\n')}\n`
}

function upstreamSection({ upstreamPrevious, upstreamNow, releases, upstreamUrl, budget }) {
  if (upstreamPrevious === upstreamNow) {
    return `## Orca\n\nStill based on Orca ${upstreamNow}; upstream was not synced in this release.\n`
  }
  const parts = [`## Orca ${upstreamPrevious} → ${upstreamNow}\n`]
  const newestPublished = releases[0]?.tagName.replace(/^v/, '')
  if (newestPublished && newestPublished !== upstreamNow) {
    // Why say so: upstream bumps package.json ahead of publishing, so the newest code in the sync
    // can be newer than any release notes there are to carry.
    parts.push(
      `Includes upstream changes up to ${upstreamNow}. The newest upstream release with published notes is ${newestPublished}; changes after it are in the [upstream history](${upstreamUrl}/compare/v${newestPublished}...main).\n`
    )
  }
  if (releases.length === 0) {
    parts.push(
      `Upstream published no release notes for this range. See the [upstream history](${upstreamUrl}/commits/main).\n`
    )
    return parts.join('\n')
  }
  let used = parts.join('\n').length
  const skipped = []
  for (const release of releases) {
    const version = release.tagName.replace(/^v/, '')
    const body = demoteHeadings((release.body ?? '').trim()) || '_No notes published._'
    const block = `### Orca ${version}\n\n${body}\n`
    if (used + block.length > budget) {
      skipped.push(release)
      continue
    }
    parts.push(block)
    used += block.length
  }
  if (skipped.length > 0) {
    // Why links rather than truncated text: a note cut mid-list reads as the whole of that release.
    const links = skipped
      .map(
        (release) =>
          `- [Orca ${release.tagName.replace(/^v/, '')}](${upstreamUrl}/releases/tag/${release.tagName})`
      )
      .join('\n')
    parts.push(
      `### Earlier upstream releases in this sync\n\nTheir notes did not fit in one release body:\n\n${links}\n`
    )
  }
  return parts.join('\n')
}

export function buildReleaseNotes({
  forkCommits,
  upstreamPrevious,
  upstreamNow,
  upstreamReleases,
  repoUrl,
  upstreamUrl,
  budget = RELEASE_BODY_BUDGET
}) {
  const fork = forkSection(forkCommits, repoUrl)
  const upstream = upstreamSection({
    upstreamPrevious,
    upstreamNow,
    releases: upstreamReleases,
    upstreamUrl,
    budget: budget - fork.length
  })
  return `${fork}\n${upstream}`
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

function packageVersionAt(ref) {
  return JSON.parse(git('show', `${ref}:package.json`)).version
}

function readArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 2) {
    args[argv[index].replace(/^--/, '')] = argv[index + 1]
  }
  return args
}

function main() {
  const args = readArgs(process.argv.slice(2))
  const repo = args.repo ?? process.env.GITHUB_REPOSITORY
  const upstreamRepo = args.upstream ?? 'stablyai/orca'
  const repoUrl = `https://github.com/${repo}`
  const upstreamUrl = `https://github.com/${upstreamRepo}`

  const existingTags = JSON.parse(
    gh('release', 'list', '--repo', repo, '--limit', '200', '--json', 'tagName')
  ).map((release) => release.tagName)
  const version = nextForkVersion(existingTags, args.version)
  const previousTag = previousForkTag(existingTags, version)
  const upstreamNow = packageVersionAt('HEAD')
  const upstreamPrevious = previousTag ? packageVersionAt(previousTag) : upstreamNow

  // Why `--not upstream/main`: a commit reachable from upstream is upstream's, including every
  // one a sync merge brings in, so what is left between the two releases is the fork's own work.
  const range = previousTag ? `${previousTag}..HEAD` : 'HEAD'
  const log = git('log', '--no-merges', '--format=%H%x09%s', range, '--not', 'upstream/main')
  const forkCommits = log
    ? log.split('\n').map((line) => {
        const [sha, ...subject] = line.split('\t')
        return { sha, subject: subject.join('\t') }
      })
    : []

  let upstreamReleases = []
  if (upstreamPrevious !== upstreamNow) {
    const listed = JSON.parse(
      gh(
        'release',
        'list',
        '--repo',
        upstreamRepo,
        '--limit',
        '200',
        '--json',
        'tagName,isPrerelease'
      )
    )
    upstreamReleases = selectUpstreamReleases(listed, upstreamPrevious, upstreamNow).map(
      (release) => ({
        ...release,
        body: JSON.parse(
          gh('release', 'view', release.tagName, '--repo', upstreamRepo, '--json', 'body')
        ).body
      })
    )
  }

  const notes = buildReleaseNotes({
    forkCommits,
    upstreamPrevious,
    upstreamNow,
    upstreamReleases,
    repoUrl,
    upstreamUrl
  })
  writeFileSync(args.out ?? 'release-notes.md', notes)

  const outputs = {
    version,
    tag: `v${version}`,
    title: releaseTitle(version, upstreamNow),
    previous_tag: previousTag ?? '',
    upstream_version: upstreamNow
  }
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`)
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, { flag: 'a' })
  }
  console.log(lines.join('\n'))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
