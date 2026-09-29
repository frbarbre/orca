export type PullRequestCommitSummary = {
  oid: string
  headline: string
  committedAt: string
}

export type ViewerReviewSummary = {
  /** 1 for the first review you submitted on this pull request, and so on. */
  ordinal: number
  commitOid: string
  state: string
  submittedAt: string
}

export type RawPullRequestReview = {
  login: string
  state: string
  commitOid: string | null
  submittedAt: string | null
}

export function buildViewerReviewHistory(
  reviews: readonly RawPullRequestReview[],
  viewerLogin: string | null
): ViewerReviewSummary[] {
  const viewer = viewerLogin?.toLowerCase()
  if (!viewer) {
    return []
  }
  return reviews
    .filter(
      (review): review is RawPullRequestReview & { commitOid: string; submittedAt: string } =>
        review.login.toLowerCase() === viewer &&
        review.state !== 'PENDING' &&
        review.commitOid !== null &&
        review.submittedAt !== null
    )
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((review, index) => ({
      ordinal: index + 1,
      commitOid: review.commitOid,
      state: review.state,
      submittedAt: review.submittedAt
    }))
}

export type ReviewBaseOption = {
  /** `commit:<oid>` for a commit on the branch, `review:<oid>` for a reviewed commit no longer on it. */
  id: string
  commitOid: string
  headline: string
  /** Which of your reviews were left on this commit, oldest first. */
  reviewOrdinals: number[]
  onBranch: boolean
}

// Why newest first: the base you usually want is recent, and the whole pull request is listed last
// as the oldest place to start from.
export function buildReviewBaseOptions(
  commits: readonly PullRequestCommitSummary[],
  reviews: readonly ViewerReviewSummary[]
): ReviewBaseOption[] {
  const ordinalsByCommit = new Map<string, number[]>()
  for (const review of reviews) {
    ordinalsByCommit.set(review.commitOid, [
      ...(ordinalsByCommit.get(review.commitOid) ?? []),
      review.ordinal
    ])
  }
  const onBranch = new Set(commits.map((commit) => commit.oid))
  const entries: (ReviewBaseOption & { at: string })[] = commits.map((commit) => ({
    id: `commit:${commit.oid}`,
    commitOid: commit.oid,
    headline: commit.headline,
    reviewOrdinals: ordinalsByCommit.get(commit.oid) ?? [],
    onBranch: true,
    at: commit.committedAt
  }))
  const seenOrphans = new Set<string>()
  for (const review of reviews) {
    if (onBranch.has(review.commitOid) || seenOrphans.has(review.commitOid)) {
      continue
    }
    seenOrphans.add(review.commitOid)
    entries.push({
      id: `review:${review.commitOid}`,
      commitOid: review.commitOid,
      headline: '',
      reviewOrdinals: ordinalsByCommit.get(review.commitOid) ?? [],
      onBranch: false,
      at: review.submittedAt
    })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...option }) => option)
}
