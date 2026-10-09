import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPyreflySessionPool } from './pyrefly-lsp-pool'

function fakeSession() {
  return { closed: false, dispose: vi.fn(), definition: vi.fn() }
}

describe('pyrefly session pool', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reuses a session per key and stops it once idle', () => {
    const start = vi.fn(fakeSession)
    const pool = createPyreflySessionPool({ start, idleMs: 1000, maxSessions: 3 })

    const first = pool.acquire('a')
    vi.advanceTimersByTime(900)
    expect(pool.acquire('a')).toBe(first)
    vi.advanceTimersByTime(900)
    expect(first.dispose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(first.dispose).toHaveBeenCalled()
    expect(pool.acquire('a')).not.toBe(first)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('stops the least recently used session past the cap, and replaces a closed one', () => {
    const pool = createPyreflySessionPool({ start: fakeSession, idleMs: 60_000, maxSessions: 2 })

    const a = pool.acquire('a')
    const b = pool.acquire('b')
    pool.acquire('a')
    pool.acquire('c')
    expect(b.dispose).toHaveBeenCalled()
    expect(a.dispose).not.toHaveBeenCalled()

    a.closed = true
    expect(pool.acquire('a')).not.toBe(a)
  })

  it('stops everything on dispose', () => {
    const pool = createPyreflySessionPool({ start: fakeSession, idleMs: 60_000, maxSessions: 3 })
    const a = pool.acquire('a')
    const b = pool.acquire('b')

    pool.disposeAll()
    expect(a.dispose).toHaveBeenCalled()
    expect(b.dispose).toHaveBeenCalled()
  })
})
