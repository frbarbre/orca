import { useSyncExternalStore } from 'react'

let authors: ReadonlyMap<string, string> = new Map()
const listeners = new Set<() => void>()

export function setPullRequestAuthors(next: ReadonlyMap<string, string>): void {
  const unchanged =
    next.size === authors.size && [...next].every(([id, login]) => authors.get(id) === login)
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

export function usePullRequestAuthor(worktreeId: string): string | null {
  const read = (): string | null => authors.get(worktreeId) ?? null
  return useSyncExternalStore(subscribe, read, read)
}
