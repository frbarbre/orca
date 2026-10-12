import type { GitBranchLineTotal } from './git-status-types'

export function sameBranchLineTotalFiles(
  a: GitBranchLineTotal['files'],
  b: GitBranchLineTotal['files']
): boolean {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  const paths = Object.keys(a)
  if (paths.length !== Object.keys(b).length) {
    return false
  }
  return paths.every((path) => {
    const other = b[path]
    return other !== undefined && a[path].added === other.added && a[path].removed === other.removed
  })
}
