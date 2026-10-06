import { describe, expect, it } from 'vitest'
import {
  encodeGitCheckAttrPaths,
  normalizeGitPathReviewAttributes,
  parseGitCheckAttrOutput
} from './git-review-attributes'

describe('parseGitCheckAttrOutput', () => {
  it('keeps set and unset review attributes and drops unspecified ones', () => {
    const stdout = [
      'tests/a.ts',
      'review-test',
      'set',
      'tests/a.ts',
      'linguist-generated',
      'unspecified',
      'pnpm-lock.yaml',
      'linguist-generated',
      'true',
      'src/a.stories.tsx',
      'review-test',
      'unset',
      'docs/a.md',
      'review-documentation',
      'false',
      ''
    ].join('\0')

    expect(parseGitCheckAttrOutput(stdout)).toEqual({
      'tests/a.ts': { 'review-test': 'set' },
      'pnpm-lock.yaml': { 'linguist-generated': 'set' },
      'src/a.stories.tsx': { 'review-test': 'unset' },
      'docs/a.md': { 'review-documentation': 'unset' }
    })
  })

  it('ignores attributes it did not ask for and non-boolean values', () => {
    const stdout = ['a.ts', 'diff', 'set', 'b.ts', 'review-test', 'custom', ''].join('\0')
    expect(parseGitCheckAttrOutput(stdout)).toEqual({})
  })
})

describe('normalizeGitPathReviewAttributes', () => {
  it('keeps only known attributes with set or unset states from an untrusted reply', () => {
    expect(
      normalizeGitPathReviewAttributes({
        'a.ts': { 'review-test': 'set', diff: 'set', 'review-assets': 42 },
        'b.ts': null,
        'c.ts': { 'linguist-generated': 'unset' }
      })
    ).toEqual({ 'a.ts': { 'review-test': 'set' }, 'c.ts': { 'linguist-generated': 'unset' } })
    expect(normalizeGitPathReviewAttributes(undefined)).toEqual({})
  })
})

describe('encodeGitCheckAttrPaths', () => {
  it('terminates every path with NUL', () => {
    expect(encodeGitCheckAttrPaths(['a', 'b c'])).toBe('a\0b c\0')
  })
})
