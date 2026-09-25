import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/selectors'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { getGitHubPRCacheKey } from '@/store/slices/github-cache-key'
import { selectReviewCacheEntry } from '@/components/right-sidebar/review-cache-entry-selection'
import { groupPRComments, type PRCommentGroup } from '../../../../shared/pr-comment-groups'
import { usePRCommentsState } from './pr-comments-store'
import type { PRInfo } from '../../../../shared/github/pull-request-types'

/**
 * The pull request a worktree's diffs belong to, and the review threads held for it.
 *
 * Why this is shared rather than derived where it is needed: the cache key is a function of repo,
 * branch and settings, and two call sites computing it separately is two chances to disagree about
 * which list they are reading.
 *
 * Why it does not fetch: tabs read this to render a badge, and a fetch per tab would turn opening a
 * pull request into one request per open file. Whoever opens the diff does the fetching.
 */
export function usePRCommentScope(worktreeId: string | null) {
  const worktree = useAppStore((s) => (worktreeId ? s.getKnownWorktreeById(worktreeId) : null))
  const repo = useRepoById(worktree?.repoId ?? null)
  const settings = useAppStore((s) => s.settings)

  const gitIdentity = worktree ? getWorktreeGitIdentityDisplay(worktree) : null
  const branch = gitIdentity?.kind === 'branch' ? gitIdentity.branchName : ''
  const prCacheKey =
    repo && branch
      ? getGitHubPRCacheKey(
          repo.path,
          repo.id,
          branch,
          settings,
          repo.connectionId,
          repo.executionHostId,
          true
        )
      : ''
  const pr: PRInfo | null = useAppStore(
    (s) => selectReviewCacheEntry(s.prCache, prCacheKey || null)?.data ?? null
  )
  const { comments, setComments, commentsRef } = usePRCommentsState(prCacheKey)
  const groups: PRCommentGroup[] = useMemo(() => groupPRComments(comments), [comments])

  return {
    repo,
    branch,
    prCacheKey,
    pr,
    prNumber: pr?.number ?? null,
    comments,
    setComments,
    commentsRef,
    groups
  }
}
