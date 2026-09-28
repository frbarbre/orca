import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { useCommitResolves } from './use-commit-resolves'
import { markReviewedCommit } from '@/lib/reviewed-commit-bases'
import { isReviewBaseRef } from '../../../../shared/github/review-base'
import { useReviewBase } from './use-review-base'

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
  useEffect(() => {
    markReviewedCommit(lastReviewedCommit)
  }, [lastReviewedCommit])
  const reviewBase = useReviewBase(
    worktree?.path ?? null,
    worktree?.head ?? null,
    lastReviewedCommit,
    wholeRef
  )
  const missing = reviewBase?.kind === 'missing' || resolution === 'missing'
  // Why the fallback to the commit: a workspace the desktop cannot run git in has no interdiff,
  // and comparing against the reviewed commit is still right as long as nobody rebased.
  const sinceReviewRef =
    reviewBase && reviewBase.kind !== 'missing' ? reviewBase.baseRef : lastReviewedCommit
  const onReviewBase =
    currentBaseRef !== null &&
    (currentBaseRef === lastReviewedCommit || isReviewBaseRef(currentBaseRef))

  const value: ReviewDiffBase = useMemo(
    () => (!missing && onReviewBase ? 'since-review' : 'whole'),
    [missing, onReviewBase]
  )

  const writeBaseRef = useCallback(
    (baseRef: string | null) => {
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
    [currentBaseRef, updateWorktreeMeta, worktree?.hostId, worktreeId]
  )

  const setValue = useCallback(
    (next: ReviewDiffBase) => writeBaseRef(next === 'since-review' ? sinceReviewRef : wholeRef),
    [sinceReviewRef, wholeRef, writeBaseRef]
  )

  // Why follow the resolved base: a rebase since the review turns the reviewed commit into the
  // wrong base, and another force-push rebuilds the interdiff under a new ref.
  useEffect(() => {
    if (onReviewBase && reviewBase && reviewBase.kind !== 'missing') {
      writeBaseRef(reviewBase.baseRef)
    }
  }, [onReviewBase, reviewBase, writeBaseRef])

  // Why repair rather than only disable: the workspace can already be parked on the commit
  // that has since been force-pushed away, and leaving it there is a diff that never loads.
  useEffect(() => {
    if (missing && onReviewBase) {
      writeBaseRef(wholeRef)
    }
  }, [missing, onReviewBase, wholeRef, writeBaseRef])

  return {
    available: Boolean(lastReviewedCommit && wholeRef),
    value,
    setValue,
    sinceReviewMissing: missing,
    wholeRef
  }
}
