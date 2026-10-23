import type { JSONContent } from '@tiptap/react'
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

/** A file named in a GitHub comment: its path as code, linking it on the branch when there is one. */
export function githubFileMentionContent(
  path: string,
  target: GitHubFileMentionTarget | null
): JSONContent {
  if (!target) {
    return { type: 'text', text: path, marks: [{ type: 'code' }] }
  }
  const host = target.host || 'github.com'
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const encodedRef = target.ref.split('/').map(encodeURIComponent).join('/')
  const href = `https://${host}/${target.owner}/${target.repo}/blob/${encodedRef}/${encodedPath}`
  return { type: 'text', text: path, marks: [{ type: 'link', attrs: { href } }, { type: 'code' }] }
}
