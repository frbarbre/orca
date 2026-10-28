import { subscribeViaWatcherProcess } from '../ipc/filesystem/watcher-process/parcel-watcher-process'
import type { WatcherProcessSubscribeOptions } from '../ipc/filesystem/watcher-process/parcel-watcher-process-protocol'
import type {
  WatcherProcessCallback,
  WatcherProcessSubscription
} from '../ipc/filesystem/watcher-process/parcel-watcher-process-subscription'
import {
  buildParcelWatcherIgnoreOptions,
  WATCHER_IGNORE_DIRS
} from '../ipc/filesystem/watchers/filesystem-watcher-ignore'
import type { WatchedFileChange } from './lsp-session'
import type { WatchProjectFiles } from './language-server-service'

type Subscribe = (
  dir: string,
  callback: WatcherProcessCallback,
  opts: WatcherProcessSubscribeOptions
) => Promise<WatcherProcessSubscription>

const BATCH_MS = 300

function merge(
  previous: WatchedFileChange['type'] | undefined,
  next: WatchedFileChange['type']
): WatchedFileChange['type'] | null {
  if (previous === 'create' && next === 'delete') {
    return null
  }
  return previous === 'create' && next === 'update' ? 'create' : next
}

/**
 * Fork: feeds a language server what changed in its project, through the crash-isolated watcher
 * child the explorer uses, with the same exclusions for generated and dependency folders.
 */
export function createProjectFileWatcher(
  subscribe: Subscribe = subscribeViaWatcherProcess,
  batchMs = BATCH_MS
): WatchProjectFiles {
  return (root, onChanges) => {
    const pending = new Map<string, WatchedFileChange['type'] | null>()
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let subscription: WatcherProcessSubscription | null = null

    const flush = (): void => {
      timer = null
      const changes = [...pending].flatMap(([filePath, type]) => (type ? [{ filePath, type }] : []))
      pending.clear()
      if (!stopped && changes.length > 0) {
        onChanges(changes)
      }
    }

    void subscribe(
      root,
      (error, events) => {
        if (error || stopped) {
          return
        }
        for (const { path, type } of events) {
          const merged = merge(pending.get(path) ?? undefined, type)
          pending.set(path, merged)
        }
        timer ??= setTimeout(flush, batchMs)
      },
      buildParcelWatcherIgnoreOptions(WATCHER_IGNORE_DIRS)
    )
      .then((next) => {
        if (stopped) {
          void next.unsubscribe()
        } else {
          subscription = next
        }
      })
      .catch((error: unknown) => {
        console.warn('[language-server] could not watch', root, error)
      })

    return () => {
      stopped = true
      if (timer) {
        clearTimeout(timer)
      }
      void subscription?.unsubscribe()
    }
  }
}
