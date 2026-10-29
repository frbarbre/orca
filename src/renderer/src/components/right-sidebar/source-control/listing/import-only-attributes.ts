import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'

// Why a cap: an imports-only change touches a few lines, and every candidate is read twice.
const MAX_CHANGED_LINES = 60

/** The changed files small enough that their change might touch only imports. */
export function importOnlyCandidates(
  lineCounts: Readonly<Record<string, { added?: number; removed?: number }>> | undefined
): string[] {
  return Object.entries(lineCounts ?? {})
    .filter(([, { added = 0, removed = 0 }]) => {
      const changed = added + removed
      return changed > 0 && changed <= MAX_CHANGED_LINES
    })
    .map(([path]) => path)
    .sort()
}

/** Marks the imports-only paths the way `.gitattributes` would, so they classify as "Imports only". */
export function withImportOnlyAttributes(
  attributes: GitPathReviewAttributes,
  importOnlyPaths: readonly string[]
): GitPathReviewAttributes {
  if (importOnlyPaths.length === 0) {
    return attributes
  }
  const next = { ...attributes }
  for (const path of importOnlyPaths) {
    next[path] = { ...next[path], 'review-imports': 'set' }
  }
  return next
}
