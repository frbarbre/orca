import { useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import { createBrowserUuid } from '@/lib/browser-uuid'
import {
  addPendingReviewComment,
  normalizePendingReviewComments,
  removePendingReviewComment,
  updatePendingReviewCommentBody,
  type PendingReviewComment
} from '../../../../shared/github/pending-review-comment'
import { setPendingReviewDrafts, usePendingReviewDrafts } from './pending-review-draft-store'

export type PendingReviewQueue = {
  comments: PendingReviewComment[]
  add: (draft: { path: string; line: number; startLine?: number; body: string }) => void
  updateBody: (id: string, body: string) => void
  remove: (id: string) => void
  clear: () => void
}

const NO_COMMENTS: PendingReviewComment[] = []

/**
 * The queue lives on this device, written through on every edit, so it is still there after
 * a restart or a crash.
 *
 * Why not on the workspace: a workspace on a remote runtime keeps its metadata on that runtime,
 * and one running upstream Orca has no field for these and drops them. Queued comments are the
 * reviewer's, not the workspace's, so this device is where they belong.
 */
export function usePendingReviewQueue(worktreeId: string | null): PendingReviewQueue {
  const worktree = useAppStore((state) =>
    worktreeId ? state.getKnownWorktreeById(worktreeId) : null
  )
  const updateWorktreeMeta = useAppStore((state) => state.updateWorktreeMeta)
  const hostId = worktree?.hostId

  const stored = usePendingReviewDrafts(worktreeId)
  const legacy = worktree?.pendingReviewComments

  // Why adopted once and then cleared: queues written before they moved to this device sit on
  // the workspace's metadata. Taking them over keeps them; clearing them stops a stale copy from
  // resurfacing if this device's queue is later emptied.
  useEffect(() => {
    if (!worktreeId || !stored.loaded || stored.comments !== undefined) {
      return
    }
    const adopted = normalizePendingReviewComments(legacy)
    if (adopted.length === 0) {
      return
    }
    setPendingReviewDrafts(worktreeId, adopted)
    void updateWorktreeMeta(
      worktreeId,
      { pendingReviewComments: [] },
      hostId ? { executionHostId: hostId } : undefined
    )
  }, [hostId, legacy, stored.comments, stored.loaded, updateWorktreeMeta, worktreeId])

  const comments = stored.comments ?? NO_COMMENTS

  const write = useCallback(
    (next: PendingReviewComment[]) => {
      if (worktreeId) {
        setPendingReviewDrafts(worktreeId, next)
      }
    },
    [worktreeId]
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
