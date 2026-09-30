import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { useCommitResolves } from './use-commit-resolves'
import { markReviewedCommit } from '@/lib/reviewed-commit-bases'
import { useReviewBase } from './use-review-base'

/** `commit:<oid>` and `review:<oid>` compare against that commit, replayed onto the branch if needed. */
export type ReviewDiffBase = 'since-review' | 'whole' | `commit:${string}` | `review:${string}`

export function isReviewDiffBase(value: string): value is ReviewDiffBase {
  return (
    value === 'since-review' ||
    value === 'whole' ||
    value.startsWith('commit:') ||
    value.startsWith('review:')
  )
}

// Why kept per workspace for the session: the picker is a reading choice, and switching tabs or
// workspaces must not throw it back to the default.
const selectionByWorktree = new Map<string, ReviewDiffBase>()

function selectedCommit(value: ReviewDiffBase, lastReviewedCommit: string | null): string | null {
  if (value === 'whole') {
    return null
  }
  if (value === 'since-review') {
    return lastReviewedCommit
  }
  const oid = value.slice(value.indexOf(':') + 1)
  // Why the parent for a picked commit: choosing a commit means reading from it, so its own
  // changes belong in the diff; a review is the point you already read up to.
  return value.startsWith('commit:') ? `${oid}^` : oid
}

/**
 * Which point the workspace's diff starts from, and how to change it.
 *
 * Why every choice but the target branch goes through the review base: a commit picked after the
 * author rebased, or merged the target in, would otherwise pull in everything the target gained.
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
  const [, setVersion] = useState(0)
  const picked = worktreeId ? (selectionByWorktree.get(worktreeId) ?? null) : null
  const fallback: ReviewDiffBase =
    lastReviewedCommit && currentBaseRef !== wholeRef ? 'since-review' : 'whole'
  const requested = picked ?? fallback

  const resolution = useCommitResolves(worktreeId, lastReviewedCommit)
  const sinceReviewMissing = resolution === 'missing'
  const value: ReviewDiffBase =
    requested === 'since-review' && (!lastReviewedCommit || sinceReviewMissing)
      ? 'whole'
      : requested
  const commit = selectedCommit(value, lastReviewedCommit)
  useEffect(() => {
    markReviewedCommit(commit)
  }, [commit])
  const reviewBase = useReviewBase(worktree?.path ?? null, worktree?.head ?? null, commit, wholeRef)

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

  // Why the commit itself when nothing resolved: a workspace the desktop cannot run git in has no
  // interdiff, and comparing against the commit is still right as long as nobody rebased.
  const canResolve = Boolean(window.api?.pendingReview?.resolveBase)
  useEffect(() => {
    if (!commit || reviewBase?.kind === 'missing') {
      writeBaseRef(wholeRef)
      return
    }
    if (reviewBase) {
      if (reviewBase.kind === 'reviewed') {
        markReviewedCommit(reviewBase.baseRef)
      }
      writeBaseRef(reviewBase.baseRef)
    } else if (!canResolve) {
      writeBaseRef(commit)
    }
  }, [canResolve, commit, reviewBase, wholeRef, writeBaseRef])

  const setValue = useCallback(
    (next: ReviewDiffBase) => {
      if (worktreeId) {
        selectionByWorktree.set(worktreeId, next)
      }
      setVersion((version) => version + 1)
    },
    [worktreeId]
  )

  return {
    available: Boolean(wholeRef),
    value,
    setValue,
    sinceReviewMissing,
    wholeRef
  }
}
