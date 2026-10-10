import { describe, expect, it } from 'vitest'
import {
  parseQuickOpenGoToLine,
  parseQuickOpenTextQuery,
  quickOpenTextMatchPreview,
  quickOpenTextSearchRows
} from './quick-open-modes'

describe('parseQuickOpenGoToLine', () => {
  it('reads a line and an optional column after a leading colon', () => {
    expect(parseQuickOpenGoToLine(':12')).toEqual({ line: 12 })
    expect(parseQuickOpenGoToLine(' :12:4 ')).toEqual({ line: 12, column: 4 })
    expect(parseQuickOpenGoToLine(':')).toEqual({})
  })

  it('leaves file queries and bad numbers alone', () => {
    expect(parseQuickOpenGoToLine('scope.py:12')).toBeNull()
    expect(parseQuickOpenGoToLine(':abc')).toBeNull()
    expect(parseQuickOpenGoToLine(':0')).toBeNull()
  })
})

describe('parseQuickOpenTextQuery', () => {
  it('reads the text after a leading %', () => {
    expect(parseQuickOpenTextQuery('%he')).toBe('he')
    expect(parseQuickOpenTextQuery('% TYPE_CHECKING ')).toBe('TYPE_CHECKING ')
    expect(parseQuickOpenTextQuery('%')).toBe('')
  })

  it('leaves a file query alone', () => {
    expect(parseQuickOpenTextQuery('base.py')).toBeNull()
    expect(parseQuickOpenTextQuery('a%b')).toBeNull()
  })
})

describe('quickOpenTextSearchRows', () => {
  it('lists each file followed by its matches', () => {
    const rows = quickOpenTextSearchRows({
      totalMatches: 3,
      truncated: false,
      files: [
        {
          filePath: '/repo/a.py',
          relativePath: 'a.py',
          matches: [
            { line: 1, column: 6, matchLength: 2, lineContent: 'from he import x' },
            { line: 4, column: 1, matchLength: 2, lineContent: 'he' }
          ]
        },
        {
          filePath: '/repo/b/c.ts',
          relativePath: 'b/c.ts',
          matches: [{ line: 9, column: 3, matchLength: 2, lineContent: 'a he' }]
        }
      ]
    })
    expect(
      rows.map((row) => [row.kind, row.relativePath, row.kind === 'match' && row.line])
    ).toEqual([
      ['file', 'a.py', false],
      ['match', 'a.py', 1],
      ['match', 'a.py', 4],
      ['file', 'b/c.ts', false],
      ['match', 'b/c.ts', 9]
    ])
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })
})

describe('quickOpenTextMatchPreview', () => {
  it('splits the line around the match and drops leading indentation', () => {
    expect(
      quickOpenTextMatchPreview({
        line: 1,
        column: 13,
        matchLength: 2,
        lineContent: '    if TYPE_he:'
      })
    ).toEqual({ before: 'if TYPE_', match: 'he', after: ':' })
  })

  it('cuts long text before the match so the match stays visible', () => {
    const preview = quickOpenTextMatchPreview({
      line: 1,
      column: 61,
      matchLength: 2,
      lineContent: `${'x'.repeat(60)}he`
    })
    expect(preview.before.startsWith('…')).toBe(true)
    expect(preview.before.length).toBeLessThan(45)
    expect(preview.match).toBe('he')
  })
})
