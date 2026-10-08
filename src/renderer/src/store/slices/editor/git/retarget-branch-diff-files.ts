import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { OpenFile } from '../types/open-file'
import { withDiffContentReloadRequest } from '../file-ids/editor-file-ids'
import { toBranchCompareSnapshot } from './git-status-reconciliation'

// Fork: a branch diff snapshots its compare when opened, so picking another diff base in the
// review shelf left the open tab on the old one. The tab keeps its id; only what it diffs against moves.
export function retargetBranchDiffFiles(
  openFiles: OpenFile[],
  worktreeId: string,
  summary: GitBranchCompareSummary,
  entries: readonly GitBranchChangeEntry[]
): OpenFile[] {
  if (summary.status !== 'ready') {
    return openFiles
  }
  const branchCompare = toBranchCompareSnapshot(summary)
  const changedPaths = new Set(entries.map((entry) => entry.path))
  let changed = false
  const next = openFiles.map((file) => {
    if (
      file.worktreeId !== worktreeId ||
      file.mode !== 'diff' ||
      !file.branchCompare ||
      (file.diffSource !== 'branch' && file.diffSource !== 'combined-branch') ||
      file.branchCompare.compareVersion === branchCompare.compareVersion
    ) {
      return file
    }
    if (file.diffSource === 'branch' && !changedPaths.has(file.relativePath)) {
      return file
    }
    changed = true
    return withDiffContentReloadRequest({ ...file, branchCompare })
  })
  return changed ? next : openFiles
}
