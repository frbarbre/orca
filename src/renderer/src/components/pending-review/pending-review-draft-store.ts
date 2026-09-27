import { useSyncExternalStore } from 'react'
import type {
  PendingReviewComment,
  PendingReviewDraftMap
} from '../../../../shared/github/pending-review-comment'

let drafts: PendingReviewDraftMap = {}
let loaded = false
let loading: Promise<void> | null = null
// Why kept apart: an edit made before the file finishes loading is newer than the file, and
// merging the file over it would quietly undo the edit — or bring a deleted draft back.
const writtenBeforeLoad = new Map<string, PendingReviewComment[]>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function withQueue(
  map: PendingReviewDraftMap,
  worktreeId: string,
  comments: PendingReviewComment[]
): PendingReviewDraftMap {
  const next = { ...map }
  if (comments.length > 0) {
    next[worktreeId] = comments
  } else {
    delete next[worktreeId]
  }
  return next
}

/** Loads the queue from this device once; later calls share the first load. */
export function loadPendingReviewDrafts(): Promise<void> {
  // Why optional: a host without the fork's preload (an older build, a web client, a test) has
  // no queue on disk to read, and that must read as an empty queue rather than a crash.
  const read = window.api?.pendingReview?.readDrafts
  loading ??= (read ? read().catch(() => ({})) : Promise.resolve({})).then((stored) => {
    let merged: PendingReviewDraftMap = stored
    for (const [worktreeId, comments] of writtenBeforeLoad) {
      merged = withQueue(merged, worktreeId, comments)
    }
    writtenBeforeLoad.clear()
    drafts = merged
    loaded = true
    emit()
  })
  return loading
}

export function arePendingReviewDraftsLoaded(): boolean {
  return loaded
}

export function getPendingReviewDrafts(worktreeId: string): PendingReviewComment[] | undefined {
  return drafts[worktreeId]
}

/** Replaces one workspace's queue, in memory at once and on disk in the background. */
export function setPendingReviewDrafts(worktreeId: string, comments: PendingReviewComment[]): void {
  drafts = withQueue(drafts, worktreeId, comments)
  if (!loaded) {
    writtenBeforeLoad.set(worktreeId, comments)
  }
  emit()
  void window.api?.pendingReview?.writeDrafts(worktreeId, comments).catch((error: unknown) => {
    console.error('[pending-review] could not save queued comments:', error)
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void loadPendingReviewDrafts()
  return () => {
    listeners.delete(listener)
  }
}

export function usePendingReviewDrafts(worktreeId: string | null): {
  comments: PendingReviewComment[] | undefined
  loaded: boolean
} {
  const readComments = (): PendingReviewComment[] | undefined =>
    worktreeId ? drafts[worktreeId] : undefined
  const readLoaded = (): boolean => loaded
  // Why a server snapshot: some surfaces render through react-dom/server, where omitting it throws.
  const comments = useSyncExternalStore(subscribe, readComments, readComments)
  const isLoaded = useSyncExternalStore(subscribe, readLoaded, readLoaded)
  return { comments, loaded: isLoaded }
}
