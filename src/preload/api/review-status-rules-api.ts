import type {
  ReviewStatusSnapshot,
  ReviewStatusSnapshotRequest
} from '../../shared/github/review-status-snapshot-types'
import type {
  SyncReviewHeadRequest,
  SyncReviewHeadResult
} from '../../shared/github/review-head-sync'

export type ReviewStatusRulesApi = {
  /** One GraphQL round trip covering every linked pull request and the review inbox. */
  snapshot: (request: ReviewStatusSnapshotRequest) => Promise<ReviewStatusSnapshot>
  /** Moves a review workspace onto the pull request's current head, unless that would lose work. */
  syncReviewHead: (request: SyncReviewHeadRequest) => Promise<SyncReviewHeadResult>
}
