import { ghExecFileAsync } from '../git/runner'
import {
  githubHostExecOptions,
  type GitHubApiRepository,
  type GitHubRepoExecOptions
} from './github-api-repository'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from './rate-limit'

const QUERY = `
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $pr) { isInMergeQueue } }
}`

// Why its own query: `gh pr view --json` has no merge queue field.
export async function isPullRequestInMergeQueue(
  repository: GitHubApiRepository,
  prNumber: number,
  ghOptions: GitHubRepoExecOptions
): Promise<boolean | undefined> {
  if (repositoryRateLimitGuard(repository, 'graphql', ghOptions).blocked) {
    return undefined
  }
  noteRepositoryRateLimitSpend(repository, 'graphql', 1, ghOptions)
  try {
    const { stdout } = await ghExecFileAsync(
      [
        'api',
        'graphql',
        '-f',
        `query=${QUERY}`,
        '-f',
        `owner=${repository.owner}`,
        '-f',
        `repo=${repository.repo}`,
        '-F',
        `pr=${prNumber}`
      ],
      { ...ghOptions, ...githubHostExecOptions(repository) }
    )
    const value = (
      JSON.parse(stdout) as {
        data?: { repository?: { pullRequest?: { isInMergeQueue?: unknown } | null } | null }
      }
    ).data?.repository?.pullRequest?.isInMergeQueue
    return typeof value === 'boolean' ? value : undefined
  } catch {
    return undefined
  }
}
