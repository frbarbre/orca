import type {
  SubmitReviewVerdictRequest,
  SubmitReviewVerdictResult
} from '../../shared/github/pending-review-comment'
import { acquire, ghExecFileAsync, release } from './gh-utils'
import { resolveGitHubRepoExecution } from './github-api-repository'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from './rate-limit'
import { buildPullRequestNodeIdQuery, buildReviewVerdictMutation } from './review-verdict-mutation'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

const nodeIdCache = new Map<string, string>()

/** Test seam: the node id is stable for a pull request and cached for the session. */
export function clearPullRequestNodeIdCache(): void {
  nodeIdCache.clear()
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

type GhOptions = Awaited<ReturnType<typeof resolveGitHubRepoExecution>>['ghOptions']

async function resolvePullRequestNodeId(
  owner: string,
  repo: string,
  number: number,
  ghOptions: GhOptions
): Promise<string | null> {
  const key = `${owner}/${repo}#${number}`
  const cached = nodeIdCache.get(key)
  if (cached) {
    return cached
  }
  const { stdout } = await ghExecFileAsync(
    ['api', 'graphql', '-f', `query=${buildPullRequestNodeIdQuery({ owner, repo, number })}`],
    ghOptions
  )
  const data = asRecord(asRecord(JSON.parse(stdout))?.data)
  const pullRequest = asRecord(asRecord(data?.repository)?.pullRequest)
  const id = pullRequest?.id
  if (typeof id !== 'string' || !id) {
    return null
  }
  nodeIdCache.set(key, id)
  return id
}

export async function submitReviewVerdict(
  request: SubmitReviewVerdictRequest
): Promise<SubmitReviewVerdictResult> {
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
    const pullRequestId = await resolvePullRequestNodeId(
      ownerRepo.owner,
      ownerRepo.repo,
      request.prNumber,
      ghOptions
    )
    if (!pullRequestId) {
      return { ok: false, error: `Could not find pull request #${request.prNumber}.` }
    }
    noteRepositoryRateLimitSpend(ownerRepo, 'graphql', 2, ghOptions)
    const { stdout } = await ghExecFileAsync(
      [
        'api',
        'graphql',
        '-f',
        `query=${buildReviewVerdictMutation({
          pullRequestId,
          verdict: request.verdict,
          body: request.body,
          comments: request.comments
        })}`
      ],
      ghOptions
    )
    const parsed: unknown = JSON.parse(stdout)
    const error = firstGraphQLError(parsed)
    if (error) {
      return { ok: false, error }
    }
    const added = asRecord(asRecord(asRecord(parsed)?.data)?.addPullRequestReview)
    const review = asRecord(added?.pullRequestReview)
    return {
      ok: true,
      url: typeof review?.url === 'string' ? review.url : '',
      state: typeof review?.state === 'string' ? review.state : ''
    }
  } catch (caught) {
    // Why the raw message: gh prints the provider's own rejection (a stale line, a
    // self-approval), and paraphrasing it would hide which comment was refused.
    return { ok: false, error: caught instanceof Error ? caught.message : String(caught) }
  } finally {
    release()
  }
}
