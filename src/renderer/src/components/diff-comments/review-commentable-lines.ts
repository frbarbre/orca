/**
 * The lines of the modified side that GitHub will accept a review comment on.
 *
 * Why this is narrower than "any line in the file": GitHub rejects a review comment whose line is
 * not part of the pull request's diff. Offering the choice on an untouched line would mean the user
 * writes the comment first and only then learns it cannot be posted, so the toggle is disabled
 * ahead of time instead.
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
