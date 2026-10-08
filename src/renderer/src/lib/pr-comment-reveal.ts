import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

const HIGHLIGHT_MS = 2_000
// Why a deadline: a request whose comment never mounts must not fire when that PR is opened later.
const REQUEST_TTL_MS = 10_000

let pending: { url: string; expiresAt: number } | null = null
let highlightedUrl: string | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getPendingUrl(): string | null {
  return pending && pending.expiresAt > Date.now() ? pending.url : null
}

function getHighlightedUrl(): string | null {
  return highlightedUrl
}

function claimReveal(url: string): void {
  pending = null
  highlightedUrl = url
  if (highlightTimer) {
    clearTimeout(highlightTimer)
  }
  highlightTimer = setTimeout(() => {
    highlightedUrl = null
    highlightTimer = null
    emit()
  }, HIGHLIGHT_MS)
  emit()
}

export function requestPRCommentReveal(url: string): void {
  pending = { url, expiresAt: Date.now() + REQUEST_TTL_MS }
  emit()
}

export function usePRCommentReveal(url: string | undefined): {
  ref: (element: HTMLElement | null) => void
  highlighted: boolean
} {
  const pendingUrl = useSyncExternalStore(subscribe, getPendingUrl, getPendingUrl)
  const highlighted =
    useSyncExternalStore(subscribe, getHighlightedUrl, getHighlightedUrl) === (url ?? null) &&
    url !== undefined
  const elementRef = useRef<HTMLElement | null>(null)
  const ref = useCallback((element: HTMLElement | null) => {
    elementRef.current = element
  }, [])

  useEffect(() => {
    if (!url || pendingUrl !== url) {
      return
    }
    claimReveal(url)
  }, [pendingUrl, url])

  useEffect(() => {
    if (!highlighted) {
      return
    }
    // Why next tick: the panel this row lives in may have just been opened and not laid out yet.
    const timer = setTimeout(
      () => elementRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      0
    )
    return () => clearTimeout(timer)
  }, [highlighted])

  return { ref, highlighted }
}
