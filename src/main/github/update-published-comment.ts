import type {
  DeletePublishedCommentRequest,
  DeletePublishedCommentResult,
  UpdatePublishedCommentRequest,
  UpdatePublishedCommentResult
} from '../../shared/github/pending-review-comment'
import { acquire, ghExecFileAsync, release } from './gh-utils'
import { resolveGitHubRepoExecution } from './github-api-repository'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from './rate-limit'

// Why variables rather than an embedded document: a body is a plain string, which `gh api -f`
// sends correctly. Only the verdict's nested `threads` array needs embedding.
const UPDATE_REVIEW_COMMENT_MUTATION = `mutation($id: ID!, $body: String!) {
  updatePullRequestReviewComment(input: { pullRequestReviewCommentId: $id, body: $body }) {
    pullRequestReviewComment { body lastEditedAt }
  }
}`

const UPDATE_REVIEW_MUTATION = `mutation($id: ID!, $body: String!) {
  updatePullRequestReview(input: { pullRequestReviewId: $id, body: $body }) {
    pullRequestReview { body lastEditedAt }
  }
}`

const DELETE_REVIEW_COMMENT_MUTATION = `mutation($id: ID!) {
  deletePullRequestReviewComment(input: { id: $id }) { clientMutationId }
}`

const MUTATIONS = {
  'review-comment': {
    query: UPDATE_REVIEW_COMMENT_MUTATION,
    field: 'updatePullRequestReviewComment',
    node: 'pullRequestReviewComment'
  },
  review: {
    query: UPDATE_REVIEW_MUTATION,
    field: 'updatePullRequestReview',
    node: 'pullRequestReview'
  }
} as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

function firstGraphQLError(payload: unknown): string | null {
  const errors = asRecord(payload)?.errors
  if (!Array.isArray(errors) || errors.length === 0) {
    return null
  }
  return errors
    .map((entry) => {
      const message = asRecord(entry)?.message
      return typeof message === 'string' ? message : ''
    })
    .filter(Boolean)
    .join('; ')
}

async function runPublishedCommentMutation(
  request: DeletePublishedCommentRequest,
  fields: string[]
): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    request.repoPath,
    request.prRepo,
    request.connectionId
  )
  if (!ownerRepo) {
    return { ok: false, error: 'Could not resolve the repository for this pull request.' }
  }
  const guard = repositoryRateLimitGuard(ownerRepo, 'graphql', ghOptions)
  if (guard.blocked) {
    return {
      ok: false,
      error: `GitHub GraphQL rate limit nearly exhausted (${guard.remaining}/${guard.limit}).`
    }
  }
  await acquire()
  try {
    noteRepositoryRateLimitSpend(ownerRepo, 'graphql', 1, ghOptions)
    const { stdout } = await ghExecFileAsync(
      ['api', 'graphql', ...fields.flatMap((field) => ['-f', field])],
      ghOptions
    )
    const payload: unknown = JSON.parse(stdout)
    const error = firstGraphQLError(payload)
    return error ? { ok: false, error } : { ok: true, payload }
  } catch (caught) {
    // Why the raw message: gh prints the provider's own rejection, which names the reason
    // an edit was refused better than any paraphrase.
    return { ok: false, error: caught instanceof Error ? caught.message : String(caught) }
  } finally {
    release()
  }
}

/** Rewrite the body of an inline review comment, or of a review's summary, already on the pull request. */
export async function updatePublishedReviewComment(
  request: UpdatePublishedCommentRequest
): Promise<UpdatePublishedCommentResult> {
  const body = request.body.trim()
  if (!body) {
    return { ok: false, error: 'A comment cannot be empty.' }
  }
  const mutation = MUTATIONS[request.kind ?? 'review-comment']
  const result = await runPublishedCommentMutation(request, [
    `query=${mutation.query}`,
    `id=${request.commentNodeId}`,
    `body=${body}`
  ])
  if (!result.ok) {
    return result
  }
  const updated = asRecord(
    asRecord(asRecord(asRecord(result.payload)?.data)?.[mutation.field])?.[mutation.node]
  )
  return {
    ok: true,
    body: typeof updated?.body === 'string' ? updated.body : body,
    lastEditedAt: typeof updated?.lastEditedAt === 'string' ? updated.lastEditedAt : null
  }
}

/** Fork: remove an inline review comment already on the pull request; its replies stay. */
export async function deletePublishedReviewComment(
  request: DeletePublishedCommentRequest
): Promise<DeletePublishedCommentResult> {
  const result = await runPublishedCommentMutation(request, [
    `query=${DELETE_REVIEW_COMMENT_MUTATION}`,
    `id=${request.commentNodeId}`
  ])
  return result.ok ? { ok: true } : result
}
