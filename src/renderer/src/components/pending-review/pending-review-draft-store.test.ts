import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function draft(id: string) {
  return { id, path: 'src/a.ts', line: 3, body: `note ${id}`, createdAt: 1 }
}

let resolveRead: (value: Record<string, unknown>) => void
let writeDrafts: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  writeDrafts = vi.fn().mockResolvedValue(undefined)
  const readDrafts = vi.fn(
    () => new Promise<Record<string, unknown>>((resolve) => (resolveRead = resolve))
  )
  vi.stubGlobal('window', { api: { pendingReview: { readDrafts, writeDrafts } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the queued-comment store', () => {
  it('shows what the file held once it loads', async () => {
    const store = await import('./pending-review-draft-store')
    const loading = store.loadPendingReviewDrafts()
    resolveRead({ 'repo::/w/one': [draft('a')] })
    await loading
    expect(store.getPendingReviewDrafts('repo::/w/one')).toStrictEqual([draft('a')])
  })

  // Why: the file is read once at startup, and a reviewer can queue a comment before it answers.
  it('keeps an edit made while the file was still loading', async () => {
    const store = await import('./pending-review-draft-store')
    const loading = store.loadPendingReviewDrafts()
    store.setPendingReviewDrafts('repo::/w/one', [draft('new')])
    resolveRead({ 'repo::/w/one': [draft('old')] })
    await loading
    expect(store.getPendingReviewDrafts('repo::/w/one')).toStrictEqual([draft('new')])
  })

  it('does not bring back a queue emptied while the file was still loading', async () => {
    const store = await import('./pending-review-draft-store')
    const loading = store.loadPendingReviewDrafts()
    store.setPendingReviewDrafts('repo::/w/one', [])
    resolveRead({ 'repo::/w/one': [draft('old')] })
    await loading
    expect(store.getPendingReviewDrafts('repo::/w/one')).toBeUndefined()
  })

  it('writes every edit through to this device', async () => {
    const store = await import('./pending-review-draft-store')
    store.setPendingReviewDrafts('repo::/w/one', [draft('a')])
    expect(writeDrafts).toHaveBeenCalledWith('repo::/w/one', [draft('a')])
  })
})
