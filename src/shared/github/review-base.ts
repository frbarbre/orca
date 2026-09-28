/** Where Orca keeps interdiff bases; the branch compare treats any ref under it as an exact base. */
export const REVIEW_BASE_REF_PREFIX = 'refs/orca/review-base/'

export function isReviewBaseRef(ref: string | null | undefined): boolean {
  return Boolean(ref?.startsWith(REVIEW_BASE_REF_PREFIX))
}

export type ResolveReviewBaseRequest = {
  worktreePath: string
  /** The commit the viewer's latest review was left on. */
  reviewedCommit: string
  /** The pull request's target branch, e.g. `refs/remotes/origin/main`. */
  targetRef: string
}

export type ResolveReviewBaseResult =
  /** The reviewed commit is still in the branch: compare against it as usual. */
  | { kind: 'reviewed'; baseRef: string }
  /** The branch was rebased: compare exactly against the reviewed version replayed onto its base. */
  | { kind: 'interdiff'; baseRef: string; conflicted: boolean }
  /** The reviewed commit is not in this repository, e.g. force-pushed away and never fetched. */
  | { kind: 'missing' }
