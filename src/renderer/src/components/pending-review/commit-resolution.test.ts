import { describe, expect, it } from 'vitest'
import { readCommitResolution } from './commit-resolution'

describe('readCommitResolution', () => {
  it('treats a produced compare as a resolvable commit', () => {
    expect(readCommitResolution('ready')).toBe('resolved')
  })

  it('treats a force-pushed commit as missing whichever way git reports it', () => {
    expect(readCommitResolution('invalid-base')).toBe('missing')
    expect(readCommitResolution('no-merge-base')).toBe('missing')
  })

  it('stays inconclusive when the probe itself failed', () => {
    expect(readCommitResolution('error')).toBe('unknown')
    expect(readCommitResolution('unborn-head')).toBe('unknown')
    expect(readCommitResolution('loading')).toBe('unknown')
  })
})
