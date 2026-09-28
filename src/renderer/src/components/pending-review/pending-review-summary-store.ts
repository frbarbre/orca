import { useCallback, useSyncExternalStore } from 'react'

/**
 * Each workspace's unsent review summary, kept on this device like its queued comments.
 *
 * Why its own store: the Source Control panel keeps one summary box across workspace switches,
 * so component state carried one review's summary into the next workspace and lost it on restart.
 */

const SAVE_DELAY_MS = 400

let summaries: Record<string, string> = {}
let loaded = false
let loading: Promise<void> | null = null
// Why kept apart: text typed before the file finishes loading is newer than the file.
const typedBeforeLoad = new Map<string, string>()
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function loadPendingReviewSummaries(): Promise<void> {
  const read = window.api?.pendingReview?.readSummaries
  loading ??= (read ? read().catch(() => ({})) : Promise.resolve({})).then((stored) => {
    summaries = { ...stored, ...Object.fromEntries(typedBeforeLoad) }
    typedBeforeLoad.clear()
    loaded = true
    emit()
  })
  return loading
}

function save(worktreeId: string, text: string): void {
  void window.api?.pendingReview?.writeSummary(worktreeId, text).catch((error: unknown) => {
    console.error('[pending-review] could not save the review summary:', error)
  })
}

/** Updates the summary at once and saves it shortly after typing stops; `now` saves immediately. */
export function setPendingReviewSummary(worktreeId: string, text: string, now = false): void {
  summaries = { ...summaries, [worktreeId]: text }
  if (!loaded) {
    typedBeforeLoad.set(worktreeId, text)
  }
  emit()
  const pending = pendingSaves.get(worktreeId)
  if (pending) {
    clearTimeout(pending)
    pendingSaves.delete(worktreeId)
  }
  if (now) {
    save(worktreeId, text)
    return
  }
  pendingSaves.set(
    worktreeId,
    setTimeout(() => {
      pendingSaves.delete(worktreeId)
      save(worktreeId, text)
    }, SAVE_DELAY_MS)
  )
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  void loadPendingReviewSummaries()
  return () => {
    listeners.delete(listener)
  }
}

export function usePendingReviewSummary(
  worktreeId: string | null
): [string, (text: string, now?: boolean) => void] {
  const read = (): string => (worktreeId ? (summaries[worktreeId] ?? '') : '')
  // Why a server snapshot: some surfaces render through react-dom/server, where omitting it throws.
  const text = useSyncExternalStore(subscribe, read, read)
  const setText = useCallback(
    (next: string, now?: boolean) => {
      if (worktreeId) {
        setPendingReviewSummary(worktreeId, next, now)
      }
    },
    [worktreeId]
  )
  return [text, setText]
}
