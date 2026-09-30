import { useEffect, useState } from 'react'
import { isGitHubAttachmentAssetUrl } from '../../../shared/github/review-asset'

// Why under four minutes: main hands back a URL GitHub signs for five, and caches it for four.
const TTL_MS = 3 * 60_000

const cache = new Map<string, { promise: Promise<string | null>; expiresAt: number }>()

export function resolveGitHubAttachmentSrc(href: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(href)
  if (hit && hit.expiresAt > now) {
    return hit.promise
  }
  const resolve = window.api?.pendingReview?.resolveAssetUrl
  const promise = resolve ? resolve(href).catch(() => null) : Promise.resolve(null)
  cache.set(href, { promise, expiresAt: now + TTL_MS })
  return promise
}

export type GitHubAttachmentSrc =
  | { status: 'pending' }
  | { status: 'ready'; src: string }
  | { status: 'failed' }

// Why: a private repository's attachment link answers 404 without a github.com session, so the
// media element gets the signed URL instead; anything else passes through untouched.
export function useGitHubAttachmentSrc(href: string): GitHubAttachmentSrc {
  const isAttachment = isGitHubAttachmentAssetUrl(href)
  const [resolved, setResolved] = useState<{ href: string; src: string | null } | null>(null)

  useEffect(() => {
    if (!isAttachment) {
      return
    }
    let cancelled = false
    void resolveGitHubAttachmentSrc(href).then((src) => {
      if (!cancelled) {
        setResolved({ href, src })
      }
    })
    return () => {
      cancelled = true
    }
  }, [href, isAttachment])

  if (!isAttachment) {
    return { status: 'ready', src: href }
  }
  if (!resolved || resolved.href !== href) {
    return { status: 'pending' }
  }
  return resolved.src ? { status: 'ready', src: resolved.src } : { status: 'failed' }
}
