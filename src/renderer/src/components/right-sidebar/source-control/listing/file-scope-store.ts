import { useSyncExternalStore } from 'react'
import type { GitPathReviewAttributes } from '../../../../../../shared/git-review-attributes'
import type { SourceControlFileFilterKey } from './file-category'

export type SourceControlFileScope = {
  hiddenCategories: ReadonlySet<SourceControlFileFilterKey>
  reviewAttributes: GitPathReviewAttributes
}

const NO_HIDDEN_CATEGORIES: ReadonlySet<SourceControlFileFilterKey> = new Set()
const NO_ATTRIBUTES: GitPathReviewAttributes = Object.freeze({})
const EMPTY_SCOPE: SourceControlFileScope = {
  hiddenCategories: NO_HIDDEN_CATEGORIES,
  reviewAttributes: NO_ATTRIBUTES
}

// Fork: the file categories Source Control hides, and the attributes that classify them, kept
// outside the panel so quick open reads a file's changes through the same filter.
let scopes: ReadonlyMap<string, SourceControlFileScope> = new Map()
const listeners = new Set<() => void>()

export function getSourceControlFileScope(worktreeId: string | null): SourceControlFileScope {
  return (worktreeId ? scopes.get(worktreeId) : undefined) ?? EMPTY_SCOPE
}

function update(worktreeId: string, patch: Partial<SourceControlFileScope>): void {
  const current = getSourceControlFileScope(worktreeId)
  const next = { ...current, ...patch }
  if (
    next.hiddenCategories === current.hiddenCategories &&
    next.reviewAttributes === current.reviewAttributes
  ) {
    return
  }
  scopes = new Map(scopes).set(worktreeId, next)
  for (const listener of listeners) {
    listener()
  }
}

export function setSourceControlHiddenCategories(
  worktreeId: string,
  hiddenCategories: ReadonlySet<SourceControlFileFilterKey>
): void {
  update(worktreeId, { hiddenCategories })
}

export function setSourceControlReviewAttributes(
  worktreeId: string,
  reviewAttributes: GitPathReviewAttributes
): void {
  update(worktreeId, { reviewAttributes })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSourceControlFileScope(worktreeId: string | null): SourceControlFileScope {
  return useSyncExternalStore(subscribe, () => getSourceControlFileScope(worktreeId))
}
