import { describe, expect, it } from 'vitest'
import {
  buildReleaseNotes,
  demoteHeadings,
  nextForkVersion,
  previousForkTag,
  releaseTitle,
  selectUpstreamReleases
} from './fork-release-notes.mjs'

const repoUrl = 'https://github.com/frbarbre/orca'
const upstreamUrl = 'https://github.com/stablyai/orca'

describe('the fork version line', () => {
  const tags = ['v1.4.230', 'v1.4.232', 'v1.4.231', 'v1.4.23-rc.3', 'mobile-android-v0.0.50']

  it('counts on from the newest fork release', () => {
    expect(nextForkVersion(tags)).toBe('1.4.233')
  })

  // Why: a tag like v1.4.23-rc.3 sorts as 1.4.23 if read loosely, which would restart the line.
  it('ignores anything that is not a plain release tag', () => {
    expect(nextForkVersion(['v1.4.23-rc.3', 'v1.4.9'])).toBe('1.4.10')
  })

  it('takes an explicit version as given', () => {
    expect(nextForkVersion(tags, '2.0.0')).toBe('2.0.0')
    expect(nextForkVersion(tags, 'v2.0.0')).toBe('2.0.0')
  })

  it('refuses to guess without an earlier release', () => {
    expect(() => nextForkVersion([])).toThrow()
  })

  it('measures from the release before, even when re-running one', () => {
    expect(previousForkTag(tags, '1.4.233')).toBe('v1.4.232')
    expect(previousForkTag(tags, '1.4.232')).toBe('v1.4.231')
  })

  it('names the upstream version beside the fork one', () => {
    expect(releaseTitle('1.4.233', '1.4.214')).toBe('1.4.233 (Orca 1.4.214)')
  })
})

describe('selectUpstreamReleases', () => {
  const releases = [
    { tagName: 'v1.4.212', isPrerelease: false },
    { tagName: 'v1.4.211', isPrerelease: false },
    { tagName: 'mobile-android-v0.0.50', isPrerelease: true },
    { tagName: 'v1.4.198', isPrerelease: false },
    { tagName: 'v1.4.197', isPrerelease: false }
  ]

  it('keeps the desktop releases after the previous sync, newest first', () => {
    expect(selectUpstreamReleases(releases, '1.4.197', '1.4.214').map((r) => r.tagName)).toEqual([
      'v1.4.212',
      'v1.4.211',
      'v1.4.198'
    ])
  })

  it('leaves out the release the fork was already on', () => {
    expect(selectUpstreamReleases(releases, '1.4.211', '1.4.212').map((r) => r.tagName)).toEqual([
      'v1.4.212'
    ])
  })
})

describe('buildReleaseNotes', () => {
  const forkCommits = [{ sha: 'a'.repeat(40), subject: 'feat(review): a fork feature' }]

  it('lists the fork’s own changes and says upstream was not synced', () => {
    const notes = buildReleaseNotes({
      forkCommits,
      upstreamPrevious: '1.4.214',
      upstreamNow: '1.4.214',
      upstreamReleases: [],
      repoUrl,
      upstreamUrl
    })
    expect(notes).toContain('- feat(review): a fork feature')
    expect(notes).toContain('Still based on Orca 1.4.214')
  })

  it('says so when a release only brings in upstream', () => {
    const notes = buildReleaseNotes({
      forkCommits: [],
      upstreamPrevious: '1.4.197',
      upstreamNow: '1.4.212',
      upstreamReleases: [{ tagName: 'v1.4.212', body: '## Fixes\n* a fix' }],
      repoUrl,
      upstreamUrl
    })
    expect(notes).toContain('No fork changes in this release')
    expect(notes).toContain('### Orca 1.4.212')
  })

  it('points past the newest published notes when upstream is ahead of its releases', () => {
    const notes = buildReleaseNotes({
      forkCommits,
      upstreamPrevious: '1.4.197',
      upstreamNow: '1.4.214',
      upstreamReleases: [{ tagName: 'v1.4.212', body: 'notes' }],
      repoUrl,
      upstreamUrl
    })
    expect(notes).toContain('The newest upstream release with published notes is 1.4.212')
  })

  // Why: GitHub refuses a release body over 125,000 characters, so a large sync must not be one.
  it('links the releases that do not fit instead of truncating them', () => {
    const notes = buildReleaseNotes({
      forkCommits,
      upstreamPrevious: '1.4.197',
      upstreamNow: '1.4.212',
      upstreamReleases: [
        { tagName: 'v1.4.212', body: 'x'.repeat(400) },
        { tagName: 'v1.4.211', body: 'y'.repeat(400) }
      ],
      repoUrl,
      upstreamUrl,
      budget: 900
    })
    expect(notes).toContain('### Orca 1.4.212')
    expect(notes).not.toContain('### Orca 1.4.211')
    expect(notes).toContain(
      '[Orca 1.4.211](https://github.com/stablyai/orca/releases/tag/v1.4.211)'
    )
  })

  it('nests upstream’s headings beneath the release they belong to', () => {
    expect(demoteHeadings('## Fixes\n### Editor\ntext')).toBe('#### Fixes\n##### Editor\ntext')
    expect(demoteHeadings('##### deep')).toBe('###### deep')
  })
})
