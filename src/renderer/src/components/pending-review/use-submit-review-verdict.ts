import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { usePRCommentScope } from '@/components/pr-comments/use-pr-comment-scope'
import type { ReviewVerdict } from '../../../../shared/github/pending-review-comment'
import type { PendingReviewQueue } from './use-pending-review-queue'

export type ReviewVerdictSubmitter = {
  /** Null when the workspace has no pull request to review. */
  prNumber: number | null
  /** The provider refuses an approve or a request-changes from the author. */
  viewerDidAuthor: boolean
  /** The verdict already on record from this reviewer, or null if they have not reviewed. */
  viewerLatestReviewState: string | null
  submit: (verdict: ReviewVerdict, body: string) => Promise<{ ok: boolean; error?: string }>
}

export function useSubmitReviewVerdict(
  worktreeId: string | null,
  queue: PendingReviewQueue
): ReviewVerdictSubmitter {
  const scope = usePRCommentScope(worktreeId)
  const fetchPRComments = useAppStore((state) => state.fetchPRComments)
  const [viewerDidAuthor, setViewerDidAuthor] = useState(false)
  const [viewerLatestReviewState, setViewerLatestReviewState] = useState<string | null>(null)
  // Why a nonce: submitting changes the verdict on record, so the banner has to re-ask.
  const [contextNonce, setContextNonce] = useState(0)

  const repo = scope.repo
  const prNumber = scope.pr?.number ?? null
  const prRepo = scope.pr?.prRepo ?? null

  useEffect(() => {
    if (!repo || prNumber === null) {
      setViewerDidAuthor(false)
      setViewerLatestReviewState(null)
      return
    }
    let cancelled = false
    void window.api.pendingReview
      .context({
        repoPath: repo.path,
        prNumber,
        prRepo,
        connectionId: repo.connectionId ?? null
      })
      .then((context) => {
        if (!cancelled) {
          setViewerDidAuthor(context.viewerDidAuthor)
          setViewerLatestReviewState(context.viewerLatestReviewState)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [contextNonce, prNumber, prRepo, repo])

  const submit = useCallback(
    async (verdict: ReviewVerdict, body: string) => {
      if (!repo || prNumber === null) {
        return { ok: false, error: 'This workspace has no pull request to review.' }
      }
      const result = await window.api.pendingReview.submit({
        repoPath: repo.path,
        prNumber,
        prRepo,
        connectionId: repo.connectionId ?? null,
        verdict,
        body,
        comments: queue.comments
      })
      if (!result.ok) {
        return result
      }
      queue.clear()
      setContextNonce((value) => value + 1)
      // Why forced: the comments were just created remotely, and only a real fetch
      // carries the thread ids they need before anyone can reply or resolve them.
      void fetchPRComments(repo.path, prNumber, { force: true, repoId: repo.id, prRepo }).catch(
        () => undefined
      )
      toast.success(`Review submitted${result.state ? ` (${result.state.toLowerCase()})` : ''}.`)
      return { ok: true }
    },
    [fetchPRComments, prNumber, prRepo, queue, repo]
  )

  return { prNumber, viewerDidAuthor, viewerLatestReviewState, submit }
}
