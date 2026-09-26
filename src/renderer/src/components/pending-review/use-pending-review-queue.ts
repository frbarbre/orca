import { useCallback, useMemo } from 'react'
import { useAppStore } from '@/store'
import { createBrowserUuid } from '@/lib/browser-uuid'
import {
  addPendingReviewComment,
  normalizePendingReviewComments,
  removePendingReviewComment,
  updatePendingReviewCommentBody,
  type PendingReviewComment
} from '../../../../shared/github/pending-review-comment'

export type PendingReviewQueue = {
  comments: PendingReviewComment[]
  add: (draft: { path: string; line: number; startLine?: number; body: string }) => void
  updateBody: (id: string, body: string) => void
  remove: (id: string) => void
  clear: () => void
}

const NO_COMMENTS: PendingReviewComment[] = []

/**
 * The queue lives on the workspace's own metadata, so it is written through on every
 * edit and is still there after a restart -- the same storage the diff notes use.
 */
export function usePendingReviewQueue(worktreeId: string | null): PendingReviewQueue {
  const worktree = useAppStore((state) =>
    worktreeId ? state.getKnownWorktreeById(worktreeId) : null
  )
  const updateWorktreeMeta = useAppStore((state) => state.updateWorktreeMeta)
  const hostId = worktree?.hostId

  const comments = useMemo(
    () => normalizePendingReviewComments(worktree?.pendingReviewComments) ?? NO_COMMENTS,
    [worktree?.pendingReviewComments]
  )

  const write = useCallback(
    (next: PendingReviewComment[]) => {
      if (!worktreeId) {
        return
      }
      void updateWorktreeMeta(
        worktreeId,
        { pendingReviewComments: next },
        hostId ? { executionHostId: hostId } : undefined
      )
    },
    [hostId, updateWorktreeMeta, worktreeId]
  )

  return useMemo(
    () => ({
      comments,
      add: (draft) =>
        write(
          addPendingReviewComment(comments, {
            id: createBrowserUuid(),
            path: draft.path,
            line: draft.line,
            ...(draft.startLine !== undefined && draft.startLine !== draft.line
              ? { startLine: draft.startLine }
              : {}),
            body: draft.body,
            createdAt: Date.now()
          })
        ),
      updateBody: (id, body) => write(updatePendingReviewCommentBody(comments, id, body)),
      remove: (id) => write(removePendingReviewComment(comments, id)),
      clear: () => write([])
    }),
    [comments, write]
  )
}
