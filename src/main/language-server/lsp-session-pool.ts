type PooledSession = { readonly closed: boolean; dispose: () => void }

// Why capped and idle-stopped: each server holds a whole project's index, a few hundred MB on a large repo.
export function createLspSessionPool<S extends PooledSession>({
  start,
  idleMs,
  maxSessions
}: {
  start: (key: string) => S
  idleMs: number
  maxSessions: number
}): {
  acquire: (key: string) => S
  disposeMatching: (matches: (key: string) => boolean) => void
  disposeAll: () => void
} {
  const entries = new Map<string, { session: S; idleTimer: ReturnType<typeof setTimeout> }>()

  const stop = (key: string): void => {
    const entry = entries.get(key)
    if (!entry) {
      return
    }
    clearTimeout(entry.idleTimer)
    entries.delete(key)
    entry.session.dispose()
  }

  const acquire = (key: string): S => {
    const existing = entries.get(key)
    if (existing) {
      clearTimeout(existing.idleTimer)
      entries.delete(key)
    }
    const session = existing && !existing.session.closed ? existing.session : start(key)
    // Re-inserting keeps the Map in least-recently-used order.
    entries.set(key, { session, idleTimer: setTimeout(() => stop(key), idleMs) })
    while (entries.size > maxSessions) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      stop(oldest)
    }
    return session
  }

  return {
    acquire,
    disposeMatching: (matches) => {
      for (const key of entries.keys()) {
        if (matches(key)) {
          stop(key)
        }
      }
    },
    disposeAll: () => {
      for (const key of entries.keys()) {
        stop(key)
      }
    }
  }
}
