import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import type { PRComment } from '../../../../../shared/github/comment-types'

/**
 * Opens the file a review comment points at, on whichever diff surface owns it.
 *
 * Why: a hosted review comment already carries `path` and a line range, but the checks panel had no
 * way to act on them — the reviewer's location was readable and unreachable. Returns `undefined`
 * when there is no worktree to resolve the path against, so the caller can leave the badge inert
 * rather than render a control that cannot do anything.
 */
export function useChecksPanelCommentLocationOpening(): ((comment: PRComment) => void) | undefined {
  const openDiffAtLocation = useAppStore((s) => s.openDiffAtLocation)
  const activeWorktree = useActiveWorktree()
  const worktreeId = activeWorktree?.id ?? null
  const worktreePath = activeWorktree?.path ?? null

  const openLocation = useCallback(
    (comment: PRComment) => {
      if (!comment.path || !worktreeId || !worktreePath) {
        return
      }
      openDiffAtLocation({
        worktreeId,
        worktreePath,
        relativePath: comment.path,
        // Why: prefer the range end — GitHub anchors a multi-line comment at its last line, which is
        // the line the reviewer's text is attached to.
        line: comment.line ?? comment.startLine ?? undefined
      })
    },
    [openDiffAtLocation, worktreeId, worktreePath]
  )

  return worktreeId && worktreePath ? openLocation : undefined
}
