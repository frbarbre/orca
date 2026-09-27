import { afterEach, describe, expect, it } from 'vitest'
import {
  getReleaseNotesUrlForVersion,
  getReleaseRepoForChannel,
  setMainReleaseRepoOverride
} from './release-channel'

afterEach(() => {
  setMainReleaseRepoOverride(null)
})

describe('release links in a fork build', () => {
  it('keep upstream’s repo until a fork arms its own', () => {
    expect(getReleaseNotesUrlForVersion('1.4.233')).toBe(
      'https://github.com/stablyai/orca/releases/tag/v1.4.233'
    )
  })

  // Why: the update card links here, and an upstream URL for a fork-only version is a 404.
  it('point release notes at the fork once it is armed', () => {
    setMainReleaseRepoOverride('frbarbre/orca')
    expect(getReleaseNotesUrlForVersion('1.4.233')).toBe(
      'https://github.com/frbarbre/orca/releases/tag/v1.4.233'
    )
    expect(getReleaseNotesUrlForVersion(null)).toBe('https://github.com/frbarbre/orca/releases')
  })

  it('move the stable and rc channels, but leave the dedicated dev-channel repos alone', () => {
    setMainReleaseRepoOverride('frbarbre/orca')
    expect(getReleaseRepoForChannel('stable')).toBe('frbarbre/orca')
    expect(getReleaseRepoForChannel('rc')).toBe('frbarbre/orca')
    expect(getReleaseRepoForChannel('hourly')).toBe('stablyai/orca-hourly')
  })
})
