import { gitOptionsForWorktree, type GitRuntimeOptions } from '../git/git-runtime-options'
import { gitExecFileAsync } from '../git/runner'
import type {
  SyncReviewHeadRequest,
  SyncReviewHeadResult
} from '../../shared/github/review-head-sync'

const OID = /^[0-9a-f]{40}$/i

export async function syncReviewHead(
  request: SyncReviewHeadRequest,
  options: GitRuntimeOptions = {}
): Promise<SyncReviewHeadResult> {
  const git = async (args: string[]): Promise<string> =>
    (
      await gitExecFileAsync(args, gitOptionsForWorktree(request.worktreePath, options))
    ).stdout.trim()
  const attempt = async (args: string[]): Promise<string | null> => {
    try {
      return await git(args)
    } catch {
      return null
    }
  }

  if (!OID.test(request.headOid)) {
    return { kind: 'skipped', reason: 'unreachable' }
  }
  const head = await git(['rev-parse', 'HEAD'])
  if (head === request.headOid) {
    return { kind: 'current' }
  }
  // Why a detached HEAD or another branch is left alone: that is a rebase in progress or a checkout the reviewer chose.
  if ((await attempt(['symbolic-ref', '--short', 'HEAD'])) !== request.branch) {
    return { kind: 'skipped', reason: 'other-branch' }
  }
  if ((await git(['status', '--porcelain', '--untracked-files=no'])).length > 0) {
    return { kind: 'skipped', reason: 'dirty' }
  }
  await attempt([
    'fetch',
    '--quiet',
    'origin',
    `+refs/heads/${request.branch}:refs/remotes/origin/${request.branch}`
  ])
  if ((await attempt(['cat-file', '-e', `${request.headOid}^{commit}`])) === null) {
    return { kind: 'skipped', reason: 'unreachable' }
  }
  const viewerEmail = (await attempt(['config', 'user.email']))?.toLowerCase() ?? null
  const localOnlyAuthors = (await git(['log', '--format=%ae', `${request.headOid}..HEAD`]))
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean)
  // Why by author: after a force-push every old commit is local-only, but only the reviewer's own would be lost work.
  if (localOnlyAuthors.length > 0 && (!viewerEmail || localOnlyAuthors.includes(viewerEmail))) {
    return { kind: 'skipped', reason: 'own-commits' }
  }
  await git(['reset', '--hard', '--quiet', request.headOid])
  return { kind: 'updated', previousHead: head }
}
