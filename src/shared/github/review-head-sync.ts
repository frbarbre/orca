import type { GitHubRepositoryIdentity } from './pull-request-types'
import type { ReviewStatusSnapshot } from './review-status-snapshot-types'

export type SyncReviewHeadRequest = {
  worktreePath: string
  branch: string
  headOid: string
}

export type SyncReviewHeadResult =
  | { kind: 'updated'; previousHead: string }
  | { kind: 'current' }
  | {
      kind: 'skipped'
      reason: 'dirty' | 'own-commits' | 'other-branch' | 'unreachable'
    }

export type ReviewHeadSyncCandidate = {
  worktreeId: string
  worktreePath: string
  branch: string
  localHead: string
  isLocal: boolean
  repo: GitHubRepositoryIdentity
  prNumber: number
}

export type ReviewHeadSync = SyncReviewHeadRequest & { worktreeId: string }

function sameRepo(a: GitHubRepositoryIdentity, b: GitHubRepositoryIdentity): boolean {
  return (
    a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase()
  )
}

export function planReviewHeadSyncs(
  candidates: readonly ReviewHeadSyncCandidate[],
  snapshot: Pick<ReviewStatusSnapshot, 'viewerLogin' | 'linkedPullRequests'>
): ReviewHeadSync[] {
  const viewer = snapshot.viewerLogin?.toLowerCase()
  if (!viewer) {
    return []
  }
  return candidates.flatMap((candidate) => {
    const pr = snapshot.linkedPullRequests.find(
      (entry) => entry.number === candidate.prNumber && sameRepo(entry.repo, candidate.repo)
    )
    const isSomeoneElses = pr?.author ? pr.author.toLowerCase() !== viewer : false
    if (
      !pr ||
      !candidate.isLocal ||
      !isSomeoneElses ||
      pr.state !== 'OPEN' ||
      !pr.headRefOid ||
      pr.headRefOid === candidate.localHead ||
      pr.headRefName !== candidate.branch
    ) {
      return []
    }
    return [
      {
        worktreeId: candidate.worktreeId,
        worktreePath: candidate.worktreePath,
        branch: candidate.branch,
        headOid: pr.headRefOid
      }
    ]
  })
}
