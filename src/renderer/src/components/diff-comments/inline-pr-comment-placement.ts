import type { PendingReviewComment } from '../../../../shared/github/pending-review-comment'
import {
  getPRCommentGroupId,
  getPRCommentGroupRoot,
  isResolvedPRCommentGroup,
  type PRCommentGroup
} from '../../../../shared/pr-comment-groups'

export type InlinePRCommentPlacement =
  | { kind: 'thread'; id: string; lineNumber: number; group: PRCommentGroup; resolved: boolean }
  | { kind: 'pending'; id: string; lineNumber: number; comment: PendingReviewComment }

/**
 * The review threads that belong on a line of this file's diff.
 *
 * Why outdated threads are dropped rather than pinned somewhere: GitHub sets `isOutdated` when it
 * can no longer map a thread to the current diff, which means the line the reviewer wrote against
 * is gone. Anchoring it to a nearby line would attach the comment to code it was never about. Those
 * threads stay readable in the comments panel, which is a list and needs no anchor.
 *
 * Why the line-count bound on top of that flag: the panel's list can be newer than the diff the
 * viewer is showing, and a zone past the last line is one Monaco silently never lays out.
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
    if (root.path !== relativePath || root.isOutdated === true) {
      continue
    }
    const lineNumber = root.line
    if (lineNumber === undefined || lineNumber < 1 || lineNumber > modifiedLineCount) {
      continue
    }
    placements.push({
      kind: 'thread',
      id: getPRCommentGroupId(group),
      lineNumber,
      group,
      resolved: isResolvedPRCommentGroup(group)
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
  return placements.sort((a, b) => a.lineNumber - b.lineNumber)
}
