import type {
  ReviewStatusSnapshot,
  ReviewStatusSnapshotRequest
} from '../../shared/github/review-status-snapshot-types'
import { parsePmApprovalTeam } from '../../shared/workspace-status-rule-config'
import { ghExecFileAsync, ghRepoExecOptions, githubRepoContext } from './gh-utils'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from './rate-limit'
import { mapReviewStatusSnapshotResponse } from './review-status-snapshot-mapping'
import { buildReviewStatusSnapshotQuery } from './review-status-snapshot-query'

const TEAM_MEMBERS_TTL_MS = 60 * 60_000

type TeamMembersCacheEntry = { logins: string[]; fetchedAt: number }

const teamMembersCache = new Map<string, TeamMembersCacheEntry>()

/** Test seam: team membership is cached for an hour, which outlives any test run. */
export function clearPmApprovalTeamCache(): void {
  teamMembersCache.clear()
}

type GhExecOptions = ReturnType<typeof ghRepoExecOptions>

async function fetchPmApprovalTeamLogins(
  team: string | null,
  ghOptions: GhExecOptions
): Promise<string[]> {
  const parsed = parsePmApprovalTeam(team)
  if (!parsed) {
    return []
  }
  const key = `${parsed.org}/${parsed.slug}`
  const cached = teamMembersCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < TEAM_MEMBERS_TTL_MS) {
    return cached.logins
  }
  try {
    noteRepositoryRateLimitSpend(null, 'core', 1, ghOptions)
    const { stdout } = await ghExecFileAsync(
      [
        'api',
        '--paginate',
        `/orgs/${parsed.org}/teams/${parsed.slug}/members`,
        '--jq',
        '.[].login'
      ],
      ghOptions
    )
    const logins = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    teamMembersCache.set(key, { logins, fetchedAt: Date.now() })
    return logins
  } catch (error) {
    console.warn(`pm-approval team lookup failed for ${key}:`, error)
    // Why: serving a stale roster beats collapsing every PR out of PM Approval
    // because one request failed.
    return cached?.logins ?? []
  }
}

export async function getReviewStatusSnapshot(
  request: ReviewStatusSnapshotRequest,
  connectionId?: string | null
): Promise<ReviewStatusSnapshot> {
  const ghOptions = ghRepoExecOptions(githubRepoContext(request.repoPath, connectionId))
  const empty: ReviewStatusSnapshot = {
    viewerLogin: null,
    linkedPullRequests: [],
    reviewRequestedPullRequests: [],
    pmApprovalTeamLogins: [],
    fetchedAt: Date.now()
  }
  const inboxRepos = request.includeReviewInbox ? request.reviewInboxRepos : []
  if (request.linkedPullRequests.length === 0 && inboxRepos.length === 0) {
    return empty
  }
  if (repositoryRateLimitGuard(null, 'graphql', ghOptions).blocked) {
    console.warn('review status snapshot skipped: GraphQL rate-limit budget exhausted')
    return empty
  }
  const query = buildReviewStatusSnapshotQuery({
    linkedPullRequests: request.linkedPullRequests,
    reviewInboxRepos: inboxRepos
  })
  try {
    noteRepositoryRateLimitSpend(null, 'graphql', 1, ghOptions)
    const [{ stdout }, pmApprovalTeamLogins] = await Promise.all([
      ghExecFileAsync(['api', 'graphql', '-f', `query=${query}`], ghOptions),
      fetchPmApprovalTeamLogins(request.pmApprovalTeam, ghOptions)
    ])
    return {
      ...mapReviewStatusSnapshotResponse(JSON.parse(stdout)),
      pmApprovalTeamLogins,
      fetchedAt: Date.now()
    }
  } catch (error) {
    console.warn('review status snapshot failed:', error)
    return empty
  }
}
