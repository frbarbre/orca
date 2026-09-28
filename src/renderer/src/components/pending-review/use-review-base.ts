import { useEffect, useState } from 'react'
import type { ResolveReviewBaseResult } from '../../../../shared/github/review-base'

/**
 * The base a "since last review" compare should use: the reviewed commit while it is still in the
 * branch, or an interdiff base once the author has rebased. Null until known, and for workspaces
 * the desktop cannot run git in itself (a remote runtime or an SSH host), which keep comparing
 * against the reviewed commit as before.
 *
 * Why the head is an input: another force-push changes what the interdiff has to be built on.
 */
export function useReviewBase(
  worktreePath: string | null,
  worktreeHead: string | null,
  reviewedCommit: string | null,
  targetRef: string | null
): ResolveReviewBaseResult | null {
  const [resolved, setResolved] = useState<ResolveReviewBaseResult | null>(null)

  useEffect(() => {
    const resolveBase = window.api?.pendingReview?.resolveBase
    if (!worktreePath || !reviewedCommit || !targetRef || !resolveBase) {
      setResolved(null)
      return
    }
    let cancelled = false
    resolveBase({ worktreePath, reviewedCommit, targetRef })
      .then((result) => {
        if (!cancelled) {
          setResolved(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [worktreePath, worktreeHead, reviewedCommit, targetRef])

  return resolved
}
