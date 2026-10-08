import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import {
  getPRCommentGroupId,
  getPRCommentGroupRoot,
  isResolvedPRCommentGroup,
  type PRCommentGroup
} from '../../../../shared/pr-comment-groups'

export type InlinePRCommentPlacement =
  | {
      kind: 'thread'
      id: string
      lineNumber: number
      group: PRCommentGroup
      resolved: boolean
      outdated: boolean
    }
  | { kind: 'pending'; id: string; lineNumber: number; comment: PendingReviewComment }

/**
 * The review threads that belong on a line of this file's diff.
 *
 * Fork. Why outdated threads stack after the last line rather than near a line: GitHub sets
 * `isOutdated` when the line the reviewer wrote against is gone, so anchoring it nearby would
 * attach it to code it was never about. A line past the end (the panel can be newer than this
 * diff) or no line at all goes there too, since a zone past the last line never lays out.
 */
export function selectInlinePRCommentPlacements(
  groups: readonly PRCommentGroup[],
  relativePath: string,
  modifiedLineCount: number,
  pendingComments: readonly PendingReviewComment[] = []
): InlinePRCommentPlacement[] {
  if (!relativePath || modifiedLineCount <= 0) {
    return []
  }
  const placements: InlinePRCommentPlacement[] = []
  for (const group of groups) {
    const root = getPRCommentGroupRoot(group)
    if (root.path !== relativePath) {
      continue
    }
    const line = root.line
    const outdated =
      root.isOutdated === true || line === undefined || line < 1 || line > modifiedLineCount
    placements.push({
      kind: 'thread',
      id: getPRCommentGroupId(group),
      lineNumber: outdated ? modifiedLineCount : line,
      group,
      resolved: isResolvedPRCommentGroup(group),
      outdated
    })
  }
  // Why the same bound as a thread: a queued comment is anchored to a diff line too, and
  // a zone past the last line is one Monaco silently never lays out.
  for (const comment of pendingComments) {
    if (comment.path !== relativePath) {
      continue
    }
    if (comment.line < 1 || comment.line > modifiedLineCount) {
      continue
    }
    placements.push({
      kind: 'pending',
      id: `pending:${comment.id}`,
      lineNumber: comment.line,
      comment
    })
  }
  // Why sorted: zones are created in iteration order, and two threads on one line should read in
  // line order rather than in whatever order the fetch returned them.
  const isOutdated = (placement: InlinePRCommentPlacement): number =>
    placement.kind === 'thread' && placement.outdated ? 1 : 0
  return placements.sort((a, b) => isOutdated(a) - isOutdated(b) || a.lineNumber - b.lineNumber)
}
