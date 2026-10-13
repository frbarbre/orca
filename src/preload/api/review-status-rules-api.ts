import type {
  ReviewStatusSnapshot,
  ReviewStatusSnapshotRequest
} from '../../shared/github/review-status-snapshot-types'
import type {
  SyncReviewHeadRequest,
  SyncReviewHeadResult
} from '../../shared/github/review-head-sync'
import type {
  WorkspaceCommandRequest,
  WorkspaceCommandResult
} from '../../shared/github/workspace-command'

export type ReviewStatusRulesApi = {
  /** One GraphQL round trip covering every linked pull request and the review inbox. */
  snapshot: (request: ReviewStatusSnapshotRequest) => Promise<ReviewStatusSnapshot>
  /** Moves a review workspace onto the pull request's current head, unless that would lose work. */
  syncReviewHead: (request: SyncReviewHeadRequest) => Promise<SyncReviewHeadResult>
  /** Runs a shell command in a registered workspace folder. */
  runWorkspaceCommand: (request: WorkspaceCommandRequest) => Promise<WorkspaceCommandResult>
}
