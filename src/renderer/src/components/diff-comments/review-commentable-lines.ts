/**
 * The lines of the modified side that GitHub will accept a review comment on.
 *
 * Fork: a comment on any other line is still offered, posted as a comment on the file that
 * quotes the line, since GitHub rejects a line comment outside the pull request's diff.
 *
 * Why only changed lines, when GitHub also allows context lines inside a hunk: the context a hunk
 * carries is not derivable from Monaco's line changes, and a comment that is certainly postable
 * beats a wider guess that sometimes fails.
 */
export type DiffLineChange = {
  modifiedStartLineNumber: number
  modifiedEndLineNumber: number
}

export function collectReviewCommentableLines(
  changes: readonly DiffLineChange[] | null | undefined
): ReadonlySet<number> {
  const lines = new Set<number>()
  for (const change of changes ?? []) {
    // Why the zero check: Monaco reports a pure deletion with modifiedEndLineNumber 0, which has no
    // line on the modified side to anchor to.
    if (change.modifiedEndLineNumber === 0) {
      continue
    }
    for (
      let line = change.modifiedStartLineNumber;
      line <= change.modifiedEndLineNumber;
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
