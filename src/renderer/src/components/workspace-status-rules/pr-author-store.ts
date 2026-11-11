import { useSyncExternalStore } from 'react'

export type PullRequestAuthor = { login: string; avatarUrl?: string }

let authors: ReadonlyMap<string, PullRequestAuthor> = new Map()
const listeners = new Set<() => void>()

export function setPullRequestAuthors(next: ReadonlyMap<string, PullRequestAuthor>): void {
  const unchanged =
    next.size === authors.size &&
    [...next].every(([id, author]) => {
      const current = authors.get(id)
      return current?.login === author.login && current.avatarUrl === author.avatarUrl
    })
  if (unchanged) {
    return
  }
  authors = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePullRequestAuthor(worktreeId: string): PullRequestAuthor | null {
  const read = (): PullRequestAuthor | null => authors.get(worktreeId) ?? null
  return useSyncExternalStore(subscribe, read, read)
}
