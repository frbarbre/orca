/**
 * The lines of the modified side that GitHub will accept a review comment on.
 *
 * Fork: a comment on any other line is still offered, posted as a comment on the file that
 * quotes the line, since GitHub rejects a line comment outside the pull request's diff.
 *
 * Fork: context lines count too, since GitHub takes a line comment anywhere in a hunk; git's hunks
 * carry three lines of context each side of a change.
 */
export type DiffLineChange = {
  modifiedStartLineNumber: number
  modifiedEndLineNumber: number
}

const HUNK_CONTEXT_LINES = 3

export function collectReviewCommentableLines(
  changes: readonly DiffLineChange[] | null | undefined
): ReadonlySet<number> {
  const lines = new Set<number>()
  for (const change of changes ?? []) {
    // Why: Monaco reports a pure deletion as modifiedEndLineNumber 0, after modifiedStartLineNumber.
    const isDeletion = change.modifiedEndLineNumber === 0
    const start = isDeletion ? change.modifiedStartLineNumber + 1 : change.modifiedStartLineNumber
    const end = isDeletion ? change.modifiedStartLineNumber : change.modifiedEndLineNumber
    for (
      let line = Math.max(1, start - HUNK_CONTEXT_LINES);
      line <= end + HUNK_CONTEXT_LINES;
      line += 1
    ) {
      lines.add(line)
    }
  }
  return lines
}

export function isRangeInDiff(
  commentableLines: ReadonlySet<number> | null,
  line: number,
  startLine: number | undefined
): boolean {
  if (commentableLines === null) {
    return true
  }
  for (let current = startLine ?? line; current <= line; current += 1) {
    if (!commentableLines.has(current)) {
      return false
    }
  }
  return true
}

export function quoteLinesOutsideDiff({
  line,
  startLine,
  code,
  body
}: {
  line: number
  startLine?: number
  code: string
  body: string
}): string {
  const label =
    startLine !== undefined && startLine !== line ? `Lines ${startLine}–${line}` : `Line ${line}`
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${label}:\n${fence}\n${code}\n${fence}\n\n${body}`
}
