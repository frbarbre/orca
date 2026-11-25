/** The part of an xterm IMarker the tracker reads; a marker follows its row as the buffer scrolls. */
export type BlockMarker = { readonly line: number; readonly isDisposed: boolean }

export type ShellDiffStat = { files: number; insertions: number; deletions: number }

export type ShellBlockContext = {
  cwd: string | null
  branch: string | null
  node: string | null
  diffStat?: ShellDiffStat | null
}

export type ShellBlock = ShellBlockContext & {
  id: number
  /** The blank row zsh prints before the command, where the header is drawn. */
  headerLine: number
  /** The first row after the echoed command. */
  outputLine: number
  /** The row the next prompt starts on; null while the command runs. */
  endLine: number | null
  exitCode: number | null
  startedAt: number
  endedAt: number | null
}

type TrackedBlock = {
  id: number
  header: BlockMarker
  output: BlockMarker
  end: BlockMarker | null
  context: ShellBlockContext
  exitCode: number | null
  startedAt: number
  endedAt: number | null
}

const DEFAULT_MAX_BLOCKS = 500

export type ShellBlockTracker = ReturnType<typeof createShellBlockTracker>

export function createShellBlockTracker(options: { maxBlocks?: number } = {}) {
  const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS
  let tracked: TrackedBlock[] = []
  let pendingHeader: BlockMarker | null = null
  let context: ShellBlockContext = { cwd: null, branch: null, node: null }
  let nextId = 1
  let snapshot: ShellBlock[] = []
  const listeners = new Set<() => void>()

  function recompute(): void {
    tracked = tracked.filter((block) => !block.header.isDisposed).slice(-maxBlocks)
    snapshot = tracked.map((block) => ({
      id: block.id,
      headerLine: block.header.line,
      outputLine: block.output.line,
      endLine: block.end && !block.end.isDisposed ? block.end.line : null,
      exitCode: block.exitCode,
      startedAt: block.startedAt,
      endedAt: block.endedAt,
      ...block.context
    }))
  }

  function publish(): void {
    recompute()
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    promptStart(header: BlockMarker): void {
      pendingHeader = header
    },
    promptInfo(info: ShellBlockContext & { histfile?: string | null }): void {
      context = { cwd: info.cwd, branch: info.branch, node: info.node, diffStat: null }
    },
    /** Read asynchronously after the prompt report; applies to the next command. */
    setDiffStat(diffStat: ShellDiffStat | null): void {
      context = { ...context, diffStat }
    },
    commandStart(output: BlockMarker, now: number): void {
      if (!pendingHeader) {
        return
      }
      tracked.push({
        id: nextId++,
        header: pendingHeader,
        output,
        end: null,
        context,
        exitCode: null,
        startedAt: now,
        endedAt: null
      })
      pendingHeader = null
      publish()
    },
    commandFinished(end: BlockMarker, exitCode: number | null, now: number): void {
      const open = tracked.at(-1)
      if (!open || open.end) {
        return
      }
      open.end = end
      open.exitCode = exitCode
      open.endedAt = now
      publish()
    },
    /** Re-reads marker rows, e.g. after the buffer scrolled or trimmed. */
    refresh: publish,
    // Why no notify here: React reads this while rendering.
    getBlocks: (): ShellBlock[] => {
      if (tracked.some((block) => block.header.isDisposed)) {
        recompute()
      }
      return snapshot
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
