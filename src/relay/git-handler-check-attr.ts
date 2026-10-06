import type { GitExec } from './git-handler-ops'
import {
  encodeGitCheckAttrPaths,
  GIT_CHECK_ATTR_MAX_PATHS,
  GIT_CHECK_ATTR_STDIN_ARGS,
  GIT_CHECK_ATTR_TIMEOUT_MS,
  parseGitCheckAttrOutput,
  type GitPathReviewAttributes
} from '../shared/git-review-attributes'

export async function checkReviewAttributesOp(
  git: GitExec,
  params: Record<string, unknown>
): Promise<GitPathReviewAttributes> {
  const worktreePath = params.worktreePath as string
  const paths = Array.isArray(params.paths)
    ? params.paths
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
        .slice(0, GIT_CHECK_ATTR_MAX_PATHS)
    : []
  if (paths.length === 0) {
    return {}
  }
  const { stdout } = await git([...GIT_CHECK_ATTR_STDIN_ARGS], worktreePath, {
    stdin: encodeGitCheckAttrPaths(paths),
    timeout: GIT_CHECK_ATTR_TIMEOUT_MS
  })
  return parseGitCheckAttrOutput(stdout)
}
