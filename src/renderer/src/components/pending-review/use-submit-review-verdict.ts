import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { usePRCommentScope } from '@/components/pr-comments/use-pr-comment-scope'
import type { ReviewVerdict } from '../../../../shared/github/pending-review-comment'
import type { PendingReviewQueue } from './use-pending-review-queue'

export function useSubmitReviewVerdict(
  worktreeId: string | null,
  queue: PendingReviewQueue
): (verdict: ReviewVerdict, body: string) => Promise<{ ok: boolean; error?: string }> {
  const scope = usePRCommentScope(worktreeId)
  const fetchPRComments = useAppStore((state) => state.fetchPRComments)

  return useCallback(
    async (verdict, body) => {
      const repo = scope.repo
      const prNumber = scope.pr?.number ?? null
      if (!repo || prNumber === null) {
        return { ok: false, error: 'This workspace has no pull request to review.' }
      }
      const result = await window.api.pendingReview.submit({
        repoPath: repo.path,
        prNumber,
        prRepo: scope.pr?.prRepo ?? null,
        connectionId: repo.connectionId ?? null,
        verdict,
        body,
        comments: queue.comments
      })
      if (!result.ok) {
        return result
      }
      queue.clear()
      // Why forced: the comments were just created remotely, and only a real fetch
      // carries the thread ids they need before anyone can reply or resolve them.
      void fetchPRComments(repo.path, prNumber, {
        force: true,
        repoId: repo.id,
        prRepo: scope.pr?.prRepo ?? null
      }).catch(() => undefined)
      toast.success(`Review submitted${result.state ? ` (${result.state.toLowerCase()})` : ''}.`)
      return { ok: true }
    },
    [fetchPRComments, queue, scope.pr, scope.repo]
  )
}
