import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import { compareFileNames } from '../../../../../../shared/file-name-sort'
import { canDiscardStatusEntry } from '../../../../../../shared/source-control-entry-actions'
import type {
  GitBranchChangeStatus,
  GitStatusEntry
} from '../../../../../../shared/git-status-types'

export const ALL_CHANGES_AREA = 'branch-worktree'

const NO_ROW_KEYS: ReadonlySet<string> = new Set()
const ONE_ROW_PER_FILE_SOURCES = new Set([
  'edit',
  'unstaged',
  'staged',
  'branch',
  'commit',
  ALL_CHANGES_AREA
])

/** The all-changes list has one row per file, so any single-file tab of that path is that row. */
export function buildAllChangesOpenRowKeys(signature: string | null): ReadonlySet<string> {
  const separator = signature?.indexOf('::') ?? -1
  if (!signature || separator === -1) {
    return NO_ROW_KEYS
  }
  const path = signature.slice(separator + 2)
  return ONE_ROW_PER_FILE_SOURCES.has(signature.slice(0, separator)) && path
    ? new Set([`${ALL_CHANGES_AREA}::${path}`])
    : NO_ROW_KEYS
}

/** Each file's uncommitted change that a discard throws away, where discarding is allowed. */
export function discardableEntriesByPath(
  statusEntries: readonly GitStatusEntry[]
): ReadonlyMap<string, GitStatusEntry> {
  return new Map(
    statusEntries.filter(canDiscardStatusEntry).map((entry) => [entry.path, entry] as const)
  )
}

function localStatus(local: readonly GitStatusEntry[]): {
  status: GitBranchChangeStatus
  oldPath?: string
} {
  if (local.some((entry) => entry.status === 'untracked' || entry.status === 'added')) {
    return { status: 'added' }
  }
  const moved = local.find((entry) => entry.status === 'renamed' || entry.status === 'copied')
  if (moved) {
    return { status: moved.status as 'renamed' | 'copied', oldPath: moved.oldPath }
  }
  return { status: 'modified' }
}

/**
 * Every file that differs from the branch base, as it stands on disk now: committed, staged,
 * unstaged and untracked changes of one path collapse into one row.
 */
export function buildAllChangeEntries(
  statusEntries: readonly GitStatusEntry[],
  branchEntries: readonly GitBranchChangeEntry[],
  {
    uncommittedOnly = false,
    lineCounts
  }: {
    uncommittedOnly?: boolean
    lineCounts?: Readonly<Record<string, { added?: number; removed?: number }>>
  } = {}
): GitBranchChangeEntry[] {
  const byPath = new Map<string, { branch?: GitBranchChangeEntry; local: GitStatusEntry[] }>()
  for (const entry of branchEntries) {
    byPath.set(entry.path, { branch: entry, local: [] })
  }
  for (const entry of statusEntries) {
    if (entry.submoduleRoot) {
      continue
    }
    const changes = byPath.get(entry.path) ?? { local: [] }
    changes.local.push(entry)
    byPath.set(entry.path, changes)
  }

  const entries: GitBranchChangeEntry[] = []
  for (const [path, { branch, local }] of byPath) {
    if (uncommittedOnly && local.length === 0) {
      continue
    }
    const deletedLocally =
      local.some((entry) => entry.status === 'deleted') &&
      !local.some((entry) => entry.status === 'untracked')
    // Fork: uncommitted-only rows describe the uncommitted change, not the file against the base.
    const fromBase =
      branch && !uncommittedOnly
        ? { status: branch.status, oldPath: branch.oldPath }
        : localStatus(local)
    if (deletedLocally && fromBase.status === 'added') {
      continue
    }
    // Why only a single source: per-area counts overlap, so adding them would double-count a line
    // touched both on the branch and since.
    const sources = uncommittedOnly ? local : [...(branch ? [branch] : []), ...local]
    const measured = uncommittedOnly ? undefined : lineCounts?.[path]
    const counts: { added?: number; removed?: number } =
      measured ?? (sources.length === 1 ? sources[0] : {})
    entries.push({
      path,
      status: deletedLocally ? 'deleted' : fromBase.status,
      ...(!deletedLocally && fromBase.oldPath ? { oldPath: fromBase.oldPath } : {}),
      ...(counts.added !== undefined ? { added: counts.added } : {}),
      ...(counts.removed !== undefined ? { removed: counts.removed } : {})
    })
  }
  return entries.sort((a, b) => compareFileNames(a.path, b.path))
}
