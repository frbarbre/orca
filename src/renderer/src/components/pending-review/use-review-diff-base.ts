import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { useCommitResolves } from './use-commit-resolves'

export type ReviewDiffBase = 'since-review' | 'whole'

/**
 * Which end of the diff the workspace is comparing against, and how to switch it.
 *
 * Why the whole pull request stays reachable: a force-push can strip the commit you last
 * reviewed off the remote, and you sometimes just want to read the change entire, so the
 * base the pull request targets is always the other tab rather than a fallback you cannot
 * choose.
 */
export function useReviewDiffBase(
  worktreeId: string | null,
  lastReviewedCommit: string | null,
  baseRefName: string | null
): {
  available: boolean
  value: ReviewDiffBase
  setValue: (next: ReviewDiffBase) => void
  sinceReviewMissing: boolean
  wholeRef: string | null
} {
  const worktree = useAppStore((state) =>
    worktreeId ? state.getKnownWorktreeById(worktreeId) : null
  )
  const updateWorktreeMeta = useAppStore((state) => state.updateWorktreeMeta)
  const wholeRef = baseRefName ? `refs/remotes/origin/${baseRefName}` : null
  const currentBaseRef = worktree?.baseRef ?? null
  const resolution = useCommitResolves(worktreeId, lastReviewedCommit)
  const missing = resolution === 'missing'

  const value: ReviewDiffBase = useMemo(
    () =>
      !missing && lastReviewedCommit && currentBaseRef === lastReviewedCommit
        ? 'since-review'
        : 'whole',
    [currentBaseRef, lastReviewedCommit, missing]
  )

  const setValue = useCallback(
    (next: ReviewDiffBase) => {
      const baseRef = next === 'since-review' ? lastReviewedCommit : wholeRef
      if (!worktreeId || !baseRef || baseRef === currentBaseRef) {
        return
      }
      const hostId = worktree?.hostId
      void updateWorktreeMeta(
        worktreeId,
        { baseRef },
        hostId ? { executionHostId: hostId } : undefined
      )
    },
    [currentBaseRef, lastReviewedCommit, updateWorktreeMeta, wholeRef, worktree?.hostId, worktreeId]
  )

  // Why repair rather than only disable: the workspace can already be parked on the commit
  // that has since been force-pushed away, and leaving it there is a diff that never loads.
  useEffect(() => {
    if (missing && lastReviewedCommit && currentBaseRef === lastReviewedCommit) {
      setValue('whole')
    }
  }, [currentBaseRef, lastReviewedCommit, missing, setValue])

  return {
    available: Boolean(lastReviewedCommit && wholeRef),
    value,
    setValue,
    sinceReviewMissing: missing,
    wholeRef
  }
}
