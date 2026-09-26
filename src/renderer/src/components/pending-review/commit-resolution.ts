import type { GitBranchCompareResult } from '../../../../shared/git-diff-compare-types'

export type CommitResolution = 'unknown' | 'resolved' | 'missing'

/**
 * Why two failing statuses count as missing: git resolves a well-formed sha that names no
 * object, so a force-pushed commit does not come back as an unresolvable ref — it comes
 * back as a base that shares no merge base with the branch. Both mean the same thing to a
 * reader, that this diff cannot be produced. Anything else is inconclusive and left alone.
 */
export function readCommitResolution(
  status: GitBranchCompareResult['summary']['status']
): CommitResolution {
  if (status === 'ready') {
    return 'resolved'
  }
  return status === 'invalid-base' || status === 'no-merge-base' ? 'missing' : 'unknown'
}
