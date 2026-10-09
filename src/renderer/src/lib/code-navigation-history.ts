export type CodeLocation = {
  worktreeId: string
  worktreeRoot: string
  filePath: string
  relativePath: string
  line: number
  column: number
  inDiff: boolean
}

export type CodeHistory = { entries: readonly CodeLocation[]; index: number }

export const EMPTY_CODE_HISTORY: CodeHistory = { entries: [], index: -1 }

const MAX_ENTRIES = 50

function samePlace(a: CodeLocation, b: CodeLocation): boolean {
  return a.worktreeId === b.worktreeId && a.filePath === b.filePath && a.inDiff === b.inDiff
}

function withCurrent(entries: readonly CodeLocation[], current: CodeLocation): CodeLocation[] {
  const last = entries.at(-1)
  return last && samePlace(last, current)
    ? [...entries.slice(0, -1), current]
    : [...entries, current]
}

export function recordJump(
  history: CodeHistory,
  from: CodeLocation,
  to: CodeLocation
): CodeHistory {
  const entries = [...withCurrent(history.entries.slice(0, history.index + 1), from), to].slice(
    -MAX_ENTRIES
  )
  return { entries, index: entries.length - 1 }
}

export function stepCodeHistory(
  history: CodeHistory,
  direction: 'back' | 'forward',
  current: CodeLocation | null
): { history: CodeHistory; location: CodeLocation } | null {
  const index = history.index + (direction === 'back' ? -1 : 1)
  const location = history.entries[index]
  if (!location) {
    return null
  }
  const here = history.entries[history.index]
  const entries =
    current && here && samePlace(here, current)
      ? history.entries.map((entry, at) => (at === history.index ? current : entry))
      : history.entries
  return { history: { entries, index }, location }
}
