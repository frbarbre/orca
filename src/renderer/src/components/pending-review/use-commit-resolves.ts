import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { getRuntimeGitBranchCompare } from '@/runtime/runtime-git-client'
import { getIndexedRepoMap } from '@/store/worktree-repo-index'
import { readCommitResolution, type CommitResolution } from './commit-resolution'

const cache = new Map<string, CommitResolution>()

/**
 * Whether a commit is still reachable in the workspace checkout.
 *
 * Why it matters here: the commit you last reviewed can be force-pushed away, and a diff
 * base git cannot resolve fails silently rather than saying so. The probe is the same
 * branch compare the diff itself would run, so a resolvable commit leaves the result warm.
 */
export function useCommitResolves(
  worktreeId: string | null,
  commit: string | null
): CommitResolution {
  const worktree = useAppStore((state) =>
    worktreeId ? state.getKnownWorktreeById(worktreeId) : null
  )
  const repo = useAppStore((state) =>
    worktree ? (getIndexedRepoMap(state.repos).get(worktree.repoId) ?? null) : null
  )
  const settings = useAppStore((state) => state.settings)
  const key = worktreeId && commit ? `${worktreeId}:${commit}` : null
  const [resolution, setResolution] = useState<CommitResolution>(() =>
    key ? (cache.get(key) ?? 'unknown') : 'unknown'
  )
  const worktreePath = worktree?.path ?? null

  useEffect(() => {
    if (!key || !commit || !worktreeId || !worktreePath) {
      setResolution('unknown')
      return
    }
    const cached = cache.get(key)
    if (cached) {
      setResolution(cached)
      return
    }
    let active = true
    void getRuntimeGitBranchCompare(
      {
        settings: getRepoOwnerRoutedSettings(settings, repo),
        worktreeId,
        worktreePath,
        connectionId: repo?.connectionId ?? undefined
      },
      commit,
      'background'
    )
      .then((result) => {
        const next = readCommitResolution(result.summary.status)
        // Why an inconclusive probe is not cached: it says nothing about the commit, so
        // the next render should be free to ask again.
        if (next !== 'unknown') {
          cache.set(key, next)
        }
        if (active) {
          setResolution(next)
        }
      })
      .catch(() => {
        if (active) {
          setResolution('unknown')
        }
      })
    return () => {
      active = false
    }
  }, [commit, key, repo, settings, worktreeId, worktreePath])

  return resolution
}
