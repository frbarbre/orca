import type {
  SubmitReviewVerdictRequest,
  SubmitReviewVerdictResult
} from '../../shared/github/pending-review-comment'

export type PendingReviewApi = {
  /** Sends the queued comments and the verdict as one review. */
  submit: (request: SubmitReviewVerdictRequest) => Promise<SubmitReviewVerdictResult>
}
