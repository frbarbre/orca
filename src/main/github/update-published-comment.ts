import type {
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

/** Rewrite the body of an inline review comment that is already on the pull request. */
export async function updatePublishedReviewComment(
  request: UpdatePublishedCommentRequest
): Promise<UpdatePublishedCommentResult> {
  const body = request.body.trim()
  if (!body) {
    return { ok: false, error: 'A comment cannot be empty.' }
  }
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
      [
        'api',
        'graphql',
        '-f',
        `query=${UPDATE_REVIEW_COMMENT_MUTATION}`,
        '-f',
        `id=${request.commentNodeId}`,
        '-f',
        `body=${body}`
      ],
      ghOptions
    )
    const parsed: unknown = JSON.parse(stdout)
    const error = firstGraphQLError(parsed)
    if (error) {
      return { ok: false, error }
    }
    const updated = asRecord(
      asRecord(asRecord(asRecord(parsed)?.data)?.updatePullRequestReviewComment)
        ?.pullRequestReviewComment
    )
    return {
      ok: true,
      body: typeof updated?.body === 'string' ? updated.body : body,
      lastEditedAt: typeof updated?.lastEditedAt === 'string' ? updated.lastEditedAt : null
    }
  } catch (caught) {
    // Why the raw message: gh prints the provider's own rejection, which names the reason
    // an edit was refused better than any paraphrase.
    return { ok: false, error: caught instanceof Error ? caught.message : String(caught) }
  } finally {
    release()
  }
}
