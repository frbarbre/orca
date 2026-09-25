import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import { usePRCommentScope } from './use-pr-comment-scope'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { useChecksPanelCommentMutations } from '@/components/right-sidebar/checks-panel/use-checks-panel-comment-mutations'
import { checksPanelAsyncResultKey } from '@/components/right-sidebar/checks-panel-async-result-key'
import { markPRCommentThreadResolved } from '@/components/right-sidebar/pr-comment-thread-resolution'
import { mergePRCommentIntoList } from '@/store/github/pr-comment-cache'
import type { PRComment } from '../../../../shared/github/comment-types'

/**
 * The review threads and actions for one diff.
 *
 * Why this is scoped to the diff's worktree rather than reusing the panel's model: the Checks panel
 * follows the active *terminal's* cwd, which is deliberate for a sidebar but wrong for a diff — a
 * diff belongs to the worktree it was opened from, whichever terminal is in front.
 *
 * Why it calls the panel's own mutation hook rather than reimplementing reply/edit/delete/react:
 * those carry optimistic updates, confirmation prompts and bot-reply formatting that must not drift
 * between the two surfaces. One implementation, two call sites.
 */
export function useInlinePRCommentActions(worktreeId: string | null) {
  const confirm = useConfirmationDialog()
  const resolveReviewThread = useAppStore((s) => s.resolveReviewThread)
  const addPRConversationComment = useAppStore((s) => s.addPRConversationComment)
  const addPRReviewCommentReply = useAppStore((s) => s.addPRReviewCommentReply)
  const setPRCommentReaction = useAppStore((s) => s.setPRCommentReaction)

  const { repo, branch, prCacheKey, pr, prNumber, setComments, commentsRef, groups } =
    usePRCommentScope(worktreeId)

  // Why the key is rebuilt rather than compared to prCacheKey: the mutation hook stamps each
  // request with checksPanelAsyncResultKey, which also carries the branch, PR number, fork and head
  // sha. Comparing against the bare cache key never matched, so every optimistic update was
  // discarded as stale and a posted reply never appeared on the card.
  const asyncKeyRef = useRef('')
  asyncKeyRef.current = checksPanelAsyncResultKey(
    prCacheKey,
    branch,
    prNumber,
    pr?.prRepo,
    pr?.headSha
  )
  const isCurrentAsyncResult = useCallback(
    (requestKey: string) => requestKey === asyncKeyRef.current,
    []
  )

  const mutations = useChecksPanelCommentMutations({
    addPRConversationComment,
    addPRReviewCommentReply,
    branch,
    commentsDisabledReason: undefined,
    commentsRef,
    confirm,
    isCurrentAsyncResult,
    pr,
    prCacheKey,
    prNumber,
    repo,
    setComments,
    setPRCommentReaction
  })

  // Why resolve is built here rather than taken from the panel's resolution hook: that hook also
  // drives the AI acknowledgement and agent-launch flow, which belongs to the panel. Clicking
  // Resolve on a card is just the thread mutation plus the optimistic flip.
  const handleResolve = useCallback(
    async (threadId: string, resolve: boolean): Promise<boolean> => {
      if (!repo || prNumber === null) {
        return false
      }
      setComments((prev) => markPRCommentThreadResolved(prev, threadId, resolve))
      const ok = await resolveReviewThread(repo.path, prNumber, threadId, resolve, {
        repoId: repo.id,
        prRepo: pr?.prRepo ?? null
      })
      if (!ok) {
        setComments((prev) => markPRCommentThreadResolved(prev, threadId, !resolve))
      }
      return ok
    },
    [pr?.prRepo, prNumber, repo, resolveReviewThread, setComments]
  )

  // Why the diff fetches for itself: the Checks panel is what used to load comments, and it only
  // does so while its tab is open. A reviewer who goes straight to a diff would otherwise see no
  // threads at all. The store call is cached and de-duplicated, so opening several files of one PR
  // costs one request.
  const fetchPRComments = useAppStore((s) => s.fetchPRComments)
  const requestedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!repo || prNumber === null || !prCacheKey || requestedRef.current === prCacheKey) {
      return
    }
    requestedRef.current = prCacheKey
    void fetchPRComments(repo.path, prNumber, {
      repoId: repo.id,
      prRepo: pr?.prRepo ?? null
    }).then(
      (result) => {
        // Why merge rather than replace: an optimistic edit made here must not be undone by a
        // response that started before it.
        setComments((prev) => (prev.length > 0 ? prev : result))
      },
      () => undefined
    )
  }, [fetchPRComments, pr?.prRepo, prCacheKey, prNumber, repo, setComments])

  // Why this is needed on top of the store action's own cache write: the cards render from this
  // working copy, and a comment posted from the diff would otherwise sit in the cache unseen until
  // something forced a refetch.
  const mergeComment = useCallback(
    (comment: PRComment) => {
      setComments((prev) => mergePRCommentIntoList(prev, comment))
    },
    [setComments]
  )

  // Why exposed here: the add-comment popover needs the same PR identity this hook already derives
  // to post a review comment, and deriving it twice invites the two drifting apart.
  const reviewTarget = useMemo(
    () =>
      repo && prNumber !== null && pr?.headSha
        ? {
            repoPath: repo.path,
            repoId: repo.id,
            prNumber,
            prRepo: pr.prRepo ?? null,
            headSha: pr.headSha
          }
        : null,
    [pr?.headSha, pr?.prRepo, prNumber, repo]
  )

  return { groups, prNumber, reviewTarget, mergeComment, ...mutations, handleResolve }
}
