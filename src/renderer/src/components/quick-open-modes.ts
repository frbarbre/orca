import type { SearchMatch, SearchResult } from '../../../shared/code-search-types'

const PREVIEW_BEFORE_MAX = 40

export function parseQuickOpenTextQuery(query: string): string | null {
  return query.startsWith('%') ? query.slice(1).trimStart() : null
}

export function parseQuickOpenGoToLine(query: string): { line?: number; column?: number } | null {
  const match = /^:(?:(\d+)(?::(\d+))?)?$/.exec(query.trim())
  if (!match) {
    return null
  }
  if (match[1] === undefined) {
    return {}
  }
  const line = Number(match[1])
  const column = match[2] === undefined ? undefined : Number(match[2])
  if (line < 1 || (column !== undefined && column < 1)) {
    return null
  }
  return column === undefined ? { line } : { line, column }
}

export type QuickOpenTextRow =
  | { kind: 'file'; key: string; filePath: string; relativePath: string; matchCount: number }
  | ({ kind: 'match'; key: string; filePath: string; relativePath: string } & SearchMatch)

export function quickOpenTextSearchRows(result: SearchResult): QuickOpenTextRow[] {
  const rows: QuickOpenTextRow[] = []
  for (const file of result.files) {
    rows.push({
      kind: 'file',
      key: `file:${file.relativePath}`,
      filePath: file.filePath,
      relativePath: file.relativePath,
      matchCount: file.matchCount ?? file.matches.length
    })
    for (const match of file.matches) {
      rows.push({
        kind: 'match',
        key: `match:${file.relativePath}:${match.line}:${match.column}`,
        filePath: file.filePath,
        relativePath: file.relativePath,
        ...match
      })
    }
  }
  return rows
}

export function quickOpenTextMatchPreview(match: SearchMatch): {
  before: string
  match: string
  after: string
} {
  const content = match.lineContent
  const start = (match.displayColumn ?? match.column) - 1
  const length = match.displayMatchLength ?? match.matchLength
  if (start < 0 || start + length > content.length) {
    return { before: content.trimStart(), match: '', after: '' }
  }
  const before = content.slice(0, start).trimStart()
  return {
    before:
      before.length > PREVIEW_BEFORE_MAX
        ? `…${before.slice(before.length - PREVIEW_BEFORE_MAX + 1)}`
        : before,
    match: content.slice(start, start + length),
    after: content.slice(start + length)
  }
}
