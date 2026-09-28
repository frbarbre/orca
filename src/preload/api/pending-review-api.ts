import type {
  PendingReviewComment,
  PendingReviewDraftMap,
  SubmitReviewVerdictRequest,
  SubmitReviewVerdictResult,
  UpdatePublishedCommentRequest,
  UpdatePublishedCommentResult
} from '../../shared/github/pending-review-comment'
import type {
  ResolveReviewBaseRequest,
  ResolveReviewBaseResult
} from '../../shared/github/review-base'

export type PendingReviewContextRequest = Pick<
  SubmitReviewVerdictRequest,
  'repoPath' | 'prNumber' | 'prRepo' | 'connectionId'
>

export type PendingReviewApi = {
  /** Sends the queued comments and the verdict as one review. */
  submit: (request: SubmitReviewVerdictRequest) => Promise<SubmitReviewVerdictResult>
  /** Every workspace's queued comments, as stored on this device. */
  readDrafts: () => Promise<PendingReviewDraftMap>
  /** Replaces one workspace's queued comments on this device. */
  writeDrafts: (worktreeId: string, comments: PendingReviewComment[]) => Promise<void>
  /** Rewrites the body of an inline review comment already on the pull request. */
  updateComment: (request: UpdatePublishedCommentRequest) => Promise<UpdatePublishedCommentResult>
  /** The base a "since last review" compare should use, rebuilt when the branch was rebased. */
  resolveBase: (request: ResolveReviewBaseRequest) => Promise<ResolveReviewBaseResult>
  /** What the viewer is allowed to do on this pull request. */
  context: (request: PendingReviewContextRequest) => Promise<{
    viewerDidAuthor: boolean
    viewerLatestReviewState: string | null
    viewerHasReviewRequest: boolean
    viewerLatestReviewCommit: string | null
  }>
}
