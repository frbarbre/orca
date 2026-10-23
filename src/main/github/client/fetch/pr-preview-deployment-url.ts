import { ghExecFileAsync, acquire, release, type LocalGitExecOptions } from '../../gh-utils'
import { resolveGitHubRepoExecution, type GitHubApiRepository } from '../../github-api-repository'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from '../../rate-limit'

const PR_DEPLOYMENTS_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      commits(last: 30) {
        nodes {
          commit {
            deployments(first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
              nodes { latestStatus { state environmentUrl } }
            }
          }
        }
      }
    }
  }
}`

type DeploymentStatus = { state?: string; environmentUrl?: string | null } | null

type PRDeploymentsResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        commits?: {
          nodes?: { commit?: { deployments?: { nodes?: { latestStatus?: DeploymentStatus }[] } } }[]
        }
      }
    }
  }
}

function newestSuccessfulDeploymentUrl(response: PRDeploymentsResponse): string | null {
  const commits = response.data?.repository?.pullRequest?.commits?.nodes ?? []
  for (const node of commits.toReversed()) {
    for (const deployment of node.commit?.deployments?.nodes ?? []) {
      const status = deployment.latestStatus
      if (status?.state === 'SUCCESS' && status.environmentUrl) {
        return status.environmentUrl
      }
    }
  }
  return null
}

export async function getPRPreviewDeploymentUrl(
  repoPath: string,
  prNumber: number,
  prRepo?: GitHubApiRepository | null,
  connectionId?: string | null,
  localGitOptions: LocalGitExecOptions = {}
): Promise<string | null> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    repoPath,
    prRepo,
    connectionId,
    localGitOptions
  )
  if (!ownerRepo) {
    return null
  }
  if (repositoryRateLimitGuard(ownerRepo, 'graphql', ghOptions).blocked) {
    return null
  }
  await acquire()
  try {
    noteRepositoryRateLimitSpend(ownerRepo, 'graphql', 1, ghOptions)
    const { stdout } = await ghExecFileAsync(
      [
        'api',
        'graphql',
        '-f',
        `query=${PR_DEPLOYMENTS_QUERY}`,
        '-f',
        `owner=${ownerRepo.owner}`,
        '-f',
        `repo=${ownerRepo.repo}`,
        '-F',
        `number=${prNumber}`
      ],
      ghOptions
    )
    return newestSuccessfulDeploymentUrl(JSON.parse(stdout) as PRDeploymentsResponse)
  } catch (err) {
    console.warn('getPRPreviewDeploymentUrl failed:', err)
    return null
  } finally {
    release()
  }
}
