import type {
  ReviewStatusSnapshot,
  ReviewStatusSnapshotRequest
} from '../../shared/github/review-status-snapshot-types'

export type ReviewStatusRulesApi = {
  /** One GraphQL round trip covering every linked pull request and the review inbox. */
  snapshot: (request: ReviewStatusSnapshotRequest) => Promise<ReviewStatusSnapshot>
}
