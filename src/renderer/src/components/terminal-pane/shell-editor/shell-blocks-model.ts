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
  /** As echoed when it started; finds the block again after its terminal is rebuilt. */
  command: string
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
  command: string
}

const DEFAULT_MAX_BLOCKS = 500

export type ShellBlockTracker = ReturnType<typeof createShellBlockTracker>

export function createShellBlockTracker(options: { maxBlocks?: number } = {}) {
  const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS
  let tracked: TrackedBlock[] = []
  let pendingHeader: BlockMarker | null = null
  let emptySubmittedAt: number | null = null
  let context: ShellBlockContext = { cwd: null, branch: null, node: null }
  let nextId = 1
  let snapshot: ShellBlock[] = []
  const listeners = new Set<() => void>()

  let lostAtSnapshot = 0
  const lostCount = (): number => tracked.filter((block) => block.header.isDisposed).length

  // Why lost blocks stay tracked: the registry may find their rows again (`lostBlockIds`, `forgetLost`).
  function recompute(): void {
    tracked = tracked.slice(-maxBlocks)
    lostAtSnapshot = lostCount()
    snapshot = tracked
      .filter((block) => !block.header.isDisposed)
      .map((block) => ({
        id: block.id,
        headerLine: block.header.line,
        outputLine: block.output.line,
        endLine: block.end && !block.end.isDisposed ? block.end.line : null,
        exitCode: block.exitCode,
        startedAt: block.startedAt,
        endedAt: block.endedAt,
        command: block.command,
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
    promptStart(header: BlockMarker, now = Date.now()): void {
      if (pendingHeader && emptySubmittedAt !== null) {
        tracked.push({
          id: nextId++,
          header: pendingHeader,
          output: header,
          end: header,
          context,
          exitCode: 0,
          startedAt: emptySubmittedAt,
          endedAt: now,
          command: ''
        })
        emptySubmittedAt = null
        pendingHeader = header
        publish()
        return
      }
      emptySubmittedAt = null
      pendingHeader = header
    },
    /** The editor ran an empty line; zsh's next prompt closes it as an empty block, as in Warp. */
    emptyCommandSubmitted(now: number): void {
      emptySubmittedAt = now
    },
    /** Row of the prompt the next command starts from, or null when there is none. */
    pendingHeaderLine: (): number | null =>
      pendingHeader && !pendingHeader.isDisposed ? pendingHeader.line : null,
    promptInfo(info: ShellBlockContext & { histfile?: string | null }): void {
      context = { cwd: info.cwd, branch: info.branch, node: info.node, diffStat: null }
    },
    /** Read asynchronously after the prompt report; applies to the next command. */
    setDiffStat(diffStat: ShellDiffStat | null): void {
      context = { ...context, diffStat }
    },
    commandStart(output: BlockMarker, now: number, command = ''): void {
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
        endedAt: null,
        command
      })
      pendingHeader = null
      publish()
    },
    /** Re-anchors blocks of a rebuilt terminal at the rows they were found on, ahead of newer blocks. */
    restore(
      found: readonly { block: ShellBlock; headerLine: number }[],
      markerAt: (line: number) => BlockMarker | undefined
    ): void {
      const restored = found.flatMap(({ block, headerLine }): TrackedBlock[] => {
        const header = markerAt(headerLine)
        const output = markerAt(headerLine + block.outputLine - block.headerLine)
        const end =
          block.endLine === null ? null : markerAt(headerLine + block.endLine - block.headerLine)
        if (!header || !output || end === undefined) {
          return []
        }
        const { cwd, branch, node, diffStat } = block
        return [
          {
            id: nextId++,
            header,
            output,
            end,
            context: { cwd, branch, node, diffStat },
            exitCode: block.exitCode,
            startedAt: block.startedAt,
            endedAt: block.endedAt,
            command: block.command
          }
        ]
      })
      tracked = [...restored, ...tracked.filter((block) => !block.header.isDisposed)].sort(
        (a, b) => a.header.line - b.header.line
      )
      publish()
    },
    /** Ids of blocks whose rows the terminal no longer marks, e.g. after its buffer was replaced. */
    lostBlockIds: (): number[] =>
      tracked.filter((block) => block.header.isDisposed).map((block) => block.id),
    /** Drops lost blocks whose rows could not be found again. */
    forgetLost(): void {
      tracked = tracked.filter((block) => !block.header.isDisposed)
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
      if (lostCount() !== lostAtSnapshot) {
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
