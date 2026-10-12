import { getChangesFilter } from '@/lib/changes-filter'
import type { EditorSlice } from '../types/editor-slice'
import type { EditorOpenTargetOptions } from '../types/open-file'

/**
 * Fork: opens a Changes row while a turn or commit is previewed, as what that turn or commit
 * changed, the latest turn included. Returns false when no turn or commit is previewed, so the
 * caller opens the row its usual way.
 */
export function openChangesFilterEntry(
  state: Pick<EditorSlice, 'openCommitDiff'>,
  worktreeId: string,
  worktreePath: string,
  relativePath: string,
  language: string,
  options?: EditorOpenTargetOptions
): boolean {
  const filter = getChangesFilter(worktreeId)
  if (!filter || filter.kind === 'uncommitted') {
    return false
  }
  const entry = filter.entries.find((candidate) => candidate.path === relativePath) ?? {
    path: relativePath,
    status: 'modified' as const
  }
  state.openCommitDiff(
    worktreeId,
    worktreePath,
    entry,
    {
      ...filter.compare,
      ...(filter.kind === 'commit'
        ? { subject: filter.subject, message: filter.message }
        : { message: filter.prompt })
    },
    language,
    options
  )
  return true
}
