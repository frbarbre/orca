import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'
import {
  encodeGitCheckAttrPaths,
  GIT_CHECK_ATTR_MAX_PATHS,
  GIT_CHECK_ATTR_STDIN_ARGS,
  GIT_CHECK_ATTR_TIMEOUT_MS,
  parseGitCheckAttrOutput,
  type GitPathReviewAttributes
} from '../../shared/git-review-attributes'

export async function checkReviewAttributes(
  worktreePath: string,
  relativePaths: string[],
  options: GitRuntimeOptions = {}
): Promise<GitPathReviewAttributes> {
  const paths = relativePaths.slice(0, GIT_CHECK_ATTR_MAX_PATHS)
  if (paths.length === 0) {
    return {}
  }
  const { stdout } = await gitExecFileAsync([...GIT_CHECK_ATTR_STDIN_ARGS], {
    ...gitOptionsForWorktree(worktreePath, options),
    stdin: encodeGitCheckAttrPaths(paths),
    timeout: GIT_CHECK_ATTR_TIMEOUT_MS
  })
  return parseGitCheckAttrOutput(stdout)
}
