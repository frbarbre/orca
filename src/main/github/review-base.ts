import { createHash } from 'node:crypto'
import { gitOptionsForWorktree, type GitRuntimeOptions } from '../git/git-runtime-options'
import { gitExecFileAsync } from '../git/runner'
import {
  REVIEW_BASE_REF_PREFIX,
  type ResolveReviewBaseRequest,
  type ResolveReviewBaseResult
} from '../../shared/github/review-base'

/**
 * The base a "since last review" compare should use for one review workspace.
 *
 * When the reviewed commit is still in the branch on the same base, that commit is the base. When
 * the author has since rebased, or merged the target branch in, a compare against it pulls in
 * everything the target branch gained meanwhile. So the reviewed version is replayed onto the
 * branch's current base -- an interdiff base -- and saved under refs/orca/review-base/, which the
 * branch compare treats as an exact base rather than looking for a merge base.
 */
export async function resolveReviewBase(
  request: ResolveReviewBaseRequest,
  options: GitRuntimeOptions = {}
): Promise<ResolveReviewBaseResult> {
  const git = async (args: string[]): Promise<string> =>
    (
      await gitExecFileAsync(args, gitOptionsForWorktree(request.worktreePath, options))
    ).stdout.trim()

  let reviewed: string
  try {
    // Why rev-parse: a picked commit arrives as `<oid>^` so the diff includes that commit itself.
    reviewed = await git(['rev-parse', '--verify', `${request.reviewedCommit.trim()}^{commit}`])
  } catch {
    return { kind: 'missing' }
  }
  const reviewedBase = await git(['merge-base', reviewed, request.targetRef])
  const currentBase = await git(['merge-base', 'HEAD', request.targetRef])
  // Why both conditions: a rebase drops the reviewed commit from the branch, and merging the
  // target branch in keeps it but moves the base; either way, comparing against the reviewed
  // commit would show everything the target branch gained as if the author wrote it.
  if (reviewedBase === currentBase && (await isAncestor(git, reviewed, 'HEAD'))) {
    return { kind: 'reviewed', baseRef: reviewed }
  }
  const { tree, conflicted } = await replayOnto(git, reviewedBase, currentBase, reviewed)
  const commit = await git([
    '-c',
    'user.name=Orca',
    '-c',
    'user.email=orca@localhost',
    'commit-tree',
    tree,
    '-p',
    currentBase,
    '-m',
    `Reviewed ${reviewed} replayed onto ${currentBase}`
  ])
  // Why the commit in the name: the branch compare caches by base ref, so a base rebuilt after
  // another force-push must be a new name or the panel keeps showing the previous interdiff.
  const key = `${REVIEW_BASE_REF_PREFIX}${reviewBaseKey(request.worktreePath)}`
  const ref = `${key}-${commit.slice(0, 12)}`
  await git(['update-ref', ref, commit])
  const stale = (await git(['for-each-ref', '--format=%(refname)', `${key}-*`]))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== ref)
  for (const staleRef of stale) {
    await git(['update-ref', '-d', staleRef])
  }
  return { kind: 'interdiff', baseRef: ref, conflicted }
}

async function isAncestor(
  git: (args: string[]) => Promise<string>,
  ancestor: string,
  descendant: string
): Promise<boolean> {
  try {
    await git(['merge-base', '--is-ancestor', ancestor, descendant])
    return true
  } catch {
    return false
  }
}

async function replayOnto(
  git: (args: string[]) => Promise<string>,
  reviewedBase: string,
  currentBase: string,
  reviewed: string
): Promise<{ tree: string; conflicted: boolean }> {
  const args = ['merge-tree', '--write-tree', '--merge-base', reviewedBase, currentBase, reviewed]
  try {
    return { tree: firstLine(await git(args)), conflicted: false }
  } catch (error) {
    // Why keep a conflicted result: merge-tree still writes a tree, with conflict markers in the
    // files both sides touched, and those are exactly the files the reviewer needs to look at.
    const tree = firstLine(readStdout(error))
    if (!/^[0-9a-f]{40}$/i.test(tree)) {
      throw error
    }
    return { tree, conflicted: true }
  }
}

function readStdout(error: unknown): string {
  return error && typeof error === 'object' && 'stdout' in error && typeof error.stdout === 'string'
    ? error.stdout
    : ''
}

function firstLine(output: string): string {
  return output.trim().split('\n')[0]?.trim() ?? ''
}

function reviewBaseKey(worktreePath: string): string {
  return createHash('sha1').update(worktreePath).digest('hex').slice(0, 16)
}
