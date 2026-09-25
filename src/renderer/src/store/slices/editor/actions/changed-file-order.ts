import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'

export type ChangedFileStepDirection = 'next' | 'previous'

/** Which section of the Source Control panel a row belongs to. */
export type ChangedFileArea = 'branch' | 'working-tree'

export type ChangedFileTarget = {
  area: ChangedFileArea
  relativePath: string
}

/**
 * A review row is addressed by `<area>::<path>` — the same key the panel gives its rows.
 *
 * Why not the path alone: a file can be modified in the working tree *and* changed on the branch,
 * which is two rows the user can visit separately. Keying on the path collapses them into one and
 * makes the branch row unreachable.
 */
export function changedFileRowKey(area: string, relativePath: string): string {
  return `${area}::${relativePath}`
}

/**
 * Split a row key back into its area and path.
 *
 * Why only the first separator: a path may itself contain `::`, so splitting on every occurrence
 * would truncate it.
 */
export function parseChangedFileRowKey(key: string): ChangedFileTarget | null {
  const separator = key.indexOf('::')
  if (separator === -1) {
    return null
  }
  const area = key.slice(0, separator)
  const relativePath = key.slice(separator + 2)
  if (relativePath.length === 0) {
    return null
  }
  return { area: area === 'branch' ? 'branch' : 'working-tree', relativePath }
}

/**
 * The review order of a worktree's changed files, as row keys: working-tree rows first, then the
 * branch-compare rows.
 *
 * Why this exists alongside the panel's published order: it is the fallback for when the Source
 * Control panel has never mounted, so it cannot honour a filter it cannot see.
 */
export function buildChangedFileOrder(
  statusEntries: readonly GitStatusEntry[],
  branchEntries: readonly GitBranchChangeEntry[]
): string[] {
  const order: string[] = []
  const seen = new Set<string>()
  const push = (key: string): void => {
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    order.push(key)
  }
  for (const entry of statusEntries) {
    push(changedFileRowKey(entry.area, entry.path))
  }
  for (const entry of branchEntries) {
    push(changedFileRowKey('branch', entry.path))
  }
  return order
}

/**
 * The row one step from `currentKey`, or `null` when there is nowhere to go.
 *
 * Why it wraps at both ends: a reviewer holding the shortcut cycles the change set instead of
 * silently stalling on the last file. An unknown `currentKey` (the open tab is not a changed file)
 * enters the list at its first row going forward, last going back.
 */
export function stepChangedFile(
  order: readonly string[],
  currentKey: string | null,
  direction: ChangedFileStepDirection
): string | null {
  if (order.length === 0) {
    return null
  }
  const currentIndex = currentKey === null ? -1 : order.indexOf(currentKey)
  if (currentIndex === -1) {
    return direction === 'next' ? order[0] : (order.at(-1) ?? null)
  }
  if (order.length === 1) {
    return null
  }
  const delta = direction === 'next' ? 1 : -1
  const nextIndex = (currentIndex + delta + order.length) % order.length
  return order[nextIndex]
}

/**
 * The key for the row the open editor tab corresponds to.
 *
 * Why the fallback: a plain edit tab has no row of its own, so enter the list at whichever row
 * carries that path rather than jumping the reviewer back to the top.
 */
export function resolveCurrentRowKey(
  order: readonly string[],
  diffSource: string | undefined,
  relativePath: string | null
): string | null {
  if (!relativePath) {
    return null
  }
  const exact = changedFileRowKey(diffSource ?? 'edit', relativePath)
  if (order.includes(exact)) {
    return exact
  }
  return order.find((key) => parseChangedFileRowKey(key)?.relativePath === relativePath) ?? null
}
