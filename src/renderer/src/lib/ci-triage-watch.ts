import type { AppState } from '@/store/types'
import type { Repo } from '../../../shared/repo-types'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'

type WatchedWorkspace = {
  repo: Pick<Repo, 'id' | 'path' | 'connectionId' | 'ciTriage'>
  candidate: { cacheKey: string; branch: string }
}

export type CiTriageFetchTarget = {
  repo: WatchedWorkspace['repo']
  prNumber: number
  branch: string
  headSha: string | undefined
  prRepo: GitHubOwnerRepo | null
}

/** The open PRs whose sidebar status shows failed checks, in repos with CI triage on. */
export function ciTriageFetchTargets(
  workspaces: Iterable<WatchedWorkspace>,
  prCache: AppState['prCache']
): CiTriageFetchTarget[] {
  const targets: CiTriageFetchTarget[] = []
  for (const { repo, candidate } of workspaces) {
    const pr = prCache[candidate.cacheKey]?.data
    if (
      !repo.ciTriage ||
      !pr ||
      pr.checksStatus !== 'failure' ||
      (pr.state !== 'open' && pr.state !== 'draft')
    ) {
      continue
    }
    targets.push({
      repo,
      prNumber: pr.number,
      branch: candidate.branch,
      headSha: pr.headSha,
      prRepo: pr.prRepo ?? null
    })
  }
  return targets
}
