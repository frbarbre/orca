import {
  getPRCommentGroupRoot,
  isResolvedPRCommentGroup,
  type PRCommentGroup
} from '../../../../shared/pr-comment-groups'

/**
 * How many review threads on a file still want an answer.
 *
 * Why outdated threads are excluded: the badge sits on a diff tab and promises what the reader will
 * find inside it. A thread GitHub can no longer map to the diff is not rendered there, so counting
 * it would send someone looking for a card that is not on any line. Those stay in the comments
 * panel, which is where they can still be read.
 *
 * Why threads and not comments: a badge of 9 on a thread of nine replies would read as nine things
 * to deal with rather than one conversation.
 */
export function countUnresolvedThreadsForPath(
  groups: readonly PRCommentGroup[],
  relativePath: string
): number {
  if (!relativePath) {
    return 0
  }
  let count = 0
  for (const group of groups) {
    const root = getPRCommentGroupRoot(group)
    if (root.path !== relativePath || root.isOutdated === true) {
      continue
    }
    if (!isResolvedPRCommentGroup(group)) {
      count += 1
    }
  }
  return count
}

/**
 * The same count for every file at once, for the Source Control list.
 *
 * Why a map rather than calling the counter per row: the list re-renders on every filter keystroke,
 * and a scan of all threads per row turns that into a scan per row per keystroke.
 */
export function buildUnresolvedThreadCountByPath(
  groups: readonly PRCommentGroup[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const group of groups) {
    const root = getPRCommentGroupRoot(group)
    if (!root.path || root.isOutdated === true || isResolvedPRCommentGroup(group)) {
      continue
    }
    counts.set(root.path, (counts.get(root.path) ?? 0) + 1)
  }
  return counts
}
