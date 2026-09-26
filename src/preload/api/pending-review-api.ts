import type {
  SubmitReviewVerdictRequest,
  SubmitReviewVerdictResult
} from '../../shared/github/pending-review-comment'

export type PendingReviewContextRequest = Pick<
  SubmitReviewVerdictRequest,
  'repoPath' | 'prNumber' | 'prRepo' | 'connectionId'
>

export type PendingReviewApi = {
  /** Sends the queued comments and the verdict as one review. */
  submit: (request: SubmitReviewVerdictRequest) => Promise<SubmitReviewVerdictResult>
  /** What the viewer is allowed to do on this pull request. */
  context: (request: PendingReviewContextRequest) => Promise<{ viewerDidAuthor: boolean }>
}
