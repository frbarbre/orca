import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectFileWatcher } from './language-server-file-watcher'
import type {
  WatcherProcessCallback,
  WatcherProcessSubscribeOptions
} from '../ipc/parcel-watcher-process'

describe('createProjectFileWatcher', () => {
  let deliver: WatcherProcessCallback = () => undefined
  const unsubscribe = vi.fn(async () => undefined)
  const subscribe = vi.fn(
    async (
      _dir: string,
      callback: WatcherProcessCallback,
      _opts: WatcherProcessSubscribeOptions
    ) => {
      deliver = callback
      return { unsubscribe }
    }
  )

  beforeEach(() => {
    vi.useFakeTimers()
    subscribe.mockClear()
    unsubscribe.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('batches what changed in the project, a file at a time, skipping generated folders', async () => {
    const onChanges = vi.fn()
    createProjectFileWatcher(subscribe, 300)('/repo/apps/backend', onChanges)
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalled())

    expect(subscribe.mock.calls[0]?.[0]).toBe('/repo/apps/backend')
    expect(JSON.stringify(subscribe.mock.calls[0]?.[2])).toContain('node_modules')
    deliver(null, [
      { type: 'create', path: '/repo/apps/backend/new.py' },
      { type: 'update', path: '/repo/apps/backend/new.py' },
      { type: 'update', path: '/repo/apps/backend/a.py' },
      { type: 'create', path: '/repo/apps/backend/scratch.py' },
      { type: 'delete', path: '/repo/apps/backend/scratch.py' },
      { type: 'create', path: '/repo/apps/backend/pkg', isDirectory: true }
    ])
    expect(onChanges).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(onChanges).toHaveBeenCalledWith([
      { filePath: '/repo/apps/backend/new.py', type: 'create' },
      { filePath: '/repo/apps/backend/a.py', type: 'update' },
      { filePath: '/repo/apps/backend/pkg', type: 'create' }
    ])
  })

  it('stops the watcher and drops a pending batch', async () => {
    const onChanges = vi.fn()
    const stop = createProjectFileWatcher(subscribe, 300)('/repo', onChanges)
    await vi.waitFor(() => expect(subscribe).toHaveBeenCalled())
    deliver(null, [{ type: 'update', path: '/repo/a.ts' }])

    stop()
    vi.advanceTimersByTime(300)
    expect(onChanges).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(unsubscribe).toHaveBeenCalled())
  })
})
