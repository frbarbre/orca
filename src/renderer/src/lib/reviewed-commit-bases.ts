import { useSyncExternalStore } from 'react'

/**
 * Commits known to be ones the viewer reviewed, so a workspace pinned to one compares against it.
 *
 * Why: upstream replaces any worktree base pinned to a raw commit sha with the pull request's base
 * branch, to repair old PR worktrees that pinned the PR head. A "since last review" base is also a
 * raw sha, and without this it was silently swapped back to the whole pull request. Only shas
 * recorded here are exempted, so upstream's repair still applies to every other pinned sha.
 */

const reviewed = new Set<string>()
const listeners = new Set<() => void>()

export function markReviewedCommit(commit: string | null | undefined): void {
  const sha = commit?.trim().toLowerCase()
  if (!sha || reviewed.has(sha)) {
    return
  }
  reviewed.add(sha)
  for (const listener of listeners) {
    listener()
  }
}

export function isReviewedCommit(commit: string | null | undefined): boolean {
  const sha = commit?.trim().toLowerCase()
  return Boolean(sha && reviewed.has(sha))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useIsReviewedCommit(commit: string | null | undefined): boolean {
  const read = (): boolean => isReviewedCommit(commit)
  // Why a server snapshot: some surfaces render through react-dom/server, where omitting it throws.
  return useSyncExternalStore(subscribe, read, read)
}
