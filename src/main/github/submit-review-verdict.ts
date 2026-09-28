import type {
  SubmitReviewVerdictRequest,
  SubmitReviewVerdictResult
} from '../../shared/github/pending-review-comment'
import { acquire, ghExecFileAsync, release } from './gh-utils'
import { resolveGitHubRepoExecution } from './github-api-repository'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from './rate-limit'
import { buildPullRequestNodeIdQuery, buildReviewVerdictMutation } from './review-verdict-mutation'
import {
  buildPullRequestReviewers,
  type PullRequestReviewer,
  type RawReview,
  type RawReviewRequest
} from '../../shared/github/pull-request-reviewers'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

type PullRequestFacts = {
  id: string
  viewerDidAuthor: boolean
  /** APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED, or null when never reviewed. */
  viewerLatestReviewState: string | null
  /** True while the reviewer is on the hook for a review they have not submitted. */
  viewerHasReviewRequest: boolean
  /** The commit the reviewer last reviewed, which a diff can be based on. */
  viewerLatestReviewCommit: string | null
  reviewers: PullRequestReviewer[]
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

async function resolvePullRequestFacts(
  owner: string,
  repo: string,
  number: number,
  ghOptions: GhOptions
): Promise<PullRequestFacts | null> {
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
  const latest = asRecord(pullRequest?.viewerLatestReview)
  const facts: PullRequestFacts = {
    id,
    viewerDidAuthor: pullRequest?.viewerDidAuthor === true,
    viewerLatestReviewState: typeof latest?.state === 'string' ? latest.state : null,
    viewerHasReviewRequest: asRecord(pullRequest?.viewerLatestReviewRequest) !== null,
    viewerLatestReviewCommit:
      typeof asRecord(latest?.commit)?.oid === 'string'
        ? String(asRecord(latest?.commit)?.oid)
        : null,
    reviewers: buildPullRequestReviewers({
      requests: readReviewRequests(pullRequest?.reviewRequests),
      latestReviews: readReviews(pullRequest?.latestReviews),
      latestOpinionatedReviews: readReviews(pullRequest?.latestOpinionatedReviews),
      authorLogin: readString(asRecord(pullRequest?.author)?.login)
    })
  }
  return facts
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function readNodes(connection: unknown): Record<string, unknown>[] {
  const nodes = asRecord(connection)?.nodes
  return Array.isArray(nodes)
    ? nodes.flatMap((node) => {
        const record = asRecord(node)
        return record ? [record] : []
      })
    : []
}

function readReviewRequests(connection: unknown): RawReviewRequest[] {
  return readNodes(connection).flatMap((node): RawReviewRequest[] => {
    const reviewer = asRecord(node.requestedReviewer)
    if (reviewer?.__typename === 'User') {
      const login = readString(reviewer.login)
      return login
        ? [
            {
              kind: 'user',
              login,
              name: readString(reviewer.name),
              avatarUrl: readString(reviewer.avatarUrl)
            }
          ]
        : []
    }
    if (reviewer?.__typename === 'Team') {
      const slug = readString(reviewer.slug)
      return slug ? [{ kind: 'team', login: slug, name: readString(reviewer.name) }] : []
    }
    return []
  })
}

function readReviews(connection: unknown): RawReview[] {
  return readNodes(connection).flatMap((node) => {
    const author = asRecord(node.author)
    const login = readString(author?.login)
    const state = readString(node.state)
    return login && state ? [{ login, avatarUrl: readString(author?.avatarUrl), state }] : []
  })
}

export async function getPullRequestReviewContext(
  request: Pick<SubmitReviewVerdictRequest, 'repoPath' | 'prNumber' | 'prRepo' | 'connectionId'>
): Promise<{
  viewerDidAuthor: boolean
  viewerLatestReviewState: string | null
  viewerHasReviewRequest: boolean
  viewerLatestReviewCommit: string | null
  reviewers: PullRequestReviewer[]
}> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    request.repoPath,
    request.prRepo,
    request.connectionId
  )
  if (!ownerRepo) {
    return {
      viewerDidAuthor: false,
      viewerLatestReviewState: null,
      viewerHasReviewRequest: false,
      viewerLatestReviewCommit: null,
      reviewers: []
    }
  }
  try {
    const facts = await resolvePullRequestFacts(
      ownerRepo.owner,
      ownerRepo.repo,
      request.prNumber,
      ghOptions
    )
    return {
      viewerDidAuthor: facts?.viewerDidAuthor === true,
      viewerLatestReviewState: facts?.viewerLatestReviewState ?? null,
      viewerHasReviewRequest: facts?.viewerHasReviewRequest === true,
      viewerLatestReviewCommit: facts?.viewerLatestReviewCommit ?? null,
      reviewers: facts?.reviewers ?? []
    }
  } catch {
    // Why false on failure: a lookup that did not answer must not hide a button the
    // reviewer is entitled to press.
    return {
      viewerDidAuthor: false,
      viewerLatestReviewState: null,
      viewerHasReviewRequest: false,
      viewerLatestReviewCommit: null,
      reviewers: []
    }
  }
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
    const facts = await resolvePullRequestFacts(
      ownerRepo.owner,
      ownerRepo.repo,
      request.prNumber,
      ghOptions
    )
    if (!facts) {
      return { ok: false, error: `Could not find pull request #${request.prNumber}.` }
    }
    noteRepositoryRateLimitSpend(ownerRepo, 'graphql', 2, ghOptions)
    const { stdout } = await ghExecFileAsync(
      [
        'api',
        'graphql',
        '-f',
        `query=${buildReviewVerdictMutation({
          pullRequestId: facts.id,
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
    // Why evicted: the viewer's latest review is part of these facts, and submitting is
    // exactly what changes it.
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
