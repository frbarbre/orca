import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { usePRCommentScope } from '@/components/pr-comments/use-pr-comment-scope'
import type { ReviewVerdict } from '../../../../shared/github/pending-review-comment'
import type { PullRequestReviewer } from '../../../../shared/github/pull-request-reviewers'
import type {
  PullRequestCommitSummary,
  ViewerReviewSummary
} from '../../../../shared/github/review-history'
import type { PendingReviewQueue } from './use-pending-review-queue'
import { translate } from '@/i18n/i18n'

export type ReviewVerdictSubmitter = {
  /** Null when the workspace has no pull request to review. */
  prNumber: number | null
  /** The provider refuses an approve or a request-changes from the author. */
  viewerDidAuthor: boolean
  /** The verdict already on record from this reviewer, or null if they have not reviewed. */
  viewerLatestReviewState: string | null
  /** True while a review is outstanding from this reviewer. */
  viewerHasReviewRequest: boolean
  /** The commit this reviewer last reviewed, or null if they never have. */
  viewerLatestReviewCommit: string | null
  /** The branch the pull request targets, which is the other end of the diff. */
  baseRefName: string | null
  /** Who is asked to review and where each of them stands; null while that is still loading. */
  reviewers: PullRequestReviewer[] | null
  /** The pull request's commits and every review you submitted on it, for picking a diff base. */
  commits: PullRequestCommitSummary[]
  viewerReviews: ViewerReviewSummary[]
  /** Asks a reviewer who already reviewed to look again. */
  rerequest: (login: string) => Promise<boolean>
  submit: (verdict: ReviewVerdict, body: string) => Promise<{ ok: boolean; error?: string }>
}

type PendingReviewContext = Awaited<ReturnType<typeof window.api.pendingReview.context>>

const NO_COMMITS: PullRequestCommitSummary[] = []
const NO_REVIEWS: ViewerReviewSummary[] = []

const EMPTY_CONTEXT: PendingReviewContext = {
  viewerDidAuthor: false,
  viewerLatestReviewState: null,
  viewerHasReviewRequest: false,
  viewerLatestReviewCommit: null,
  reviewers: [],
  commits: [],
  viewerReviews: []
}

export function useSubmitReviewVerdict(
  worktreeId: string | null,
  queue: PendingReviewQueue
): ReviewVerdictSubmitter {
  const scope = usePRCommentScope(worktreeId)
  const fetchPRComments = useAppStore((state) => state.fetchPRComments)
  const [loaded, setLoaded] = useState<{ key: string; context: PendingReviewContext } | null>(null)
  // Why a nonce: submitting changes the verdict on record, so the banner has to re-ask.
  const [contextNonce, setContextNonce] = useState(0)

  const repo = scope.repo
  const prNumber = scope.pr?.number ?? null
  const prRepo = scope.pr?.prRepo ?? null
  const contextKey =
    repo && prNumber !== null ? JSON.stringify([repo.path, prRepo, prNumber]) : null
  // Why keyed: after a workspace switch the last pull request's answer must not stand in for this one's.
  const context = loaded && loaded.key === contextKey ? loaded.context : null

  useEffect(() => {
    if (!repo || prNumber === null || contextKey === null) {
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
      .catch(() => EMPTY_CONTEXT)
      .then((next) => {
        if (!cancelled) {
          setLoaded({ key: contextKey, context: next })
        }
      })
    return () => {
      cancelled = true
    }
  }, [contextKey, contextNonce, prNumber, prRepo, repo])

  const rerequest = useCallback(
    async (login: string) => {
      if (!repo || prNumber === null) {
        return false
      }
      const result = await window.api.gh.requestPRReviewers({
        repoPath: repo.path,
        repoId: repo.id,
        prNumber,
        reviewers: [login],
        prRepo
      })
      if (!result.ok) {
        toast.error(
          translate(
            'auto.components.pendingReview.rerequestFailed',
            'Could not ask {{login}} to review again: {{reason}}',
            { login, reason: result.error }
          )
        )
        return false
      }
      setContextNonce((value) => value + 1)
      return true
    },
    [prNumber, prRepo, repo]
  )

  const submit = useCallback(
    async (verdict: ReviewVerdict, body: string) => {
      if (!repo || prNumber === null) {
        return {
          ok: false,
          error: translate(
            'auto.components.pendingReview.noPullRequest',
            'This workspace has no pull request to review.'
          )
        }
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
      toast.success(
        result.state
          ? translate(
              'auto.components.pendingReview.submittedWithState',
              'Review submitted ({{state}}).',
              {
                state: result.state.toLowerCase()
              }
            )
          : translate('auto.components.pendingReview.submitted', 'Review submitted.')
      )
      return { ok: true }
    },
    [fetchPRComments, prNumber, prRepo, queue, repo]
  )

  return {
    prNumber,
    viewerDidAuthor: context?.viewerDidAuthor ?? false,
    viewerLatestReviewState: context?.viewerLatestReviewState ?? null,
    viewerHasReviewRequest: context?.viewerHasReviewRequest ?? false,
    viewerLatestReviewCommit: context?.viewerLatestReviewCommit ?? null,
    baseRefName: scope.pr?.baseRefName ?? null,
    reviewers: contextKey === null ? [] : (context?.reviewers ?? null),
    commits: context?.commits ?? NO_COMMITS,
    viewerReviews: context?.viewerReviews ?? NO_REVIEWS,
    rerequest,
    submit
  }
}
