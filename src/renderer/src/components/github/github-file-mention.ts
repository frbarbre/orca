import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'

export type GitHubFileMentionTarget = GitHubRepositoryIdentity & { ref: string }

/** Where a file named in a pull request's conversation lives on GitHub: its head branch. */
export function githubFileMentionTarget(
  pr: {
    headRefName?: string
    prRepo?: GitHubRepositoryIdentity
    headRepo?: GitHubRepositoryIdentity
  } | null,
  worktreeBranch: string
): GitHubFileMentionTarget | null {
  const repo = pr?.headRepo ?? pr?.prRepo
  const ref = pr?.headRefName || worktreeBranch
  return repo && ref ? { ...repo, ref } : null
}

/** A file named in a GitHub comment: a link to it on the branch, or its path as code. */
export function githubFileMentionMarkdown(
  path: string,
  target: GitHubFileMentionTarget | null
): string {
  if (!target) {
    return `\`${path}\``
  }
  const host = target.host || 'github.com'
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const encodedRef = target.ref.split('/').map(encodeURIComponent).join('/')
  return `[\`${path}\`](https://${host}/${target.owner}/${target.repo}/blob/${encodedRef}/${encodedPath})`
}
