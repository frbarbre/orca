import { ipcMain } from 'electron'
import type { GitBlameLinksRequest, GitBlameRequest } from '../../shared/git-blame'
import { gitExecFileAsync } from '../git/runner'
import { ghExecFileAsync } from '../github/gh-utils'
import { getOwnerRepo } from '../github/github-owner-repo-selection'
import type { OwnerRepo } from '../github/github-repository-identity'
import { githubHostExecOptions } from '../github/github-repository-host'
import { noteRepositoryRateLimitSpend, repositoryRateLimitGuard } from '../github/rate-limit'
import { createGitBlameService } from '../git-blame/git-blame-service'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function readBlameRequest(value: unknown): GitBlameRequest | null {
  const { worktreeRoot, filePath, line, text } = (value ?? {}) as Record<string, unknown>
  return isString(worktreeRoot) &&
    isString(filePath) &&
    isString(text) &&
    typeof line === 'number' &&
    Number.isInteger(line) &&
    line > 0
    ? { worktreeRoot, filePath, line, text }
    : null
}

function readLinksRequest(value: unknown): GitBlameLinksRequest | null {
  const { worktreeRoot, sha, summary } = (value ?? {}) as Record<string, unknown>
  return isString(worktreeRoot) &&
    isString(sha) &&
    /^[0-9a-f]{7,64}$/i.test(sha) &&
    isString(summary)
    ? { worktreeRoot, sha, summary }
    : null
}

async function githubApi(ownerRepo: OwnerRepo, endpoint: string): Promise<unknown> {
  if (repositoryRateLimitGuard(ownerRepo, 'core').blocked) {
    throw new Error('GitHub rate limit reached.')
  }
  noteRepositoryRateLimitSpend(ownerRepo, 'core', 1)
  const { stdout } = await ghExecFileAsync(['api', endpoint], githubHostExecOptions(ownerRepo))
  return JSON.parse(stdout) as unknown
}

// Fork: the Git Blame line annotation (author, commit and PR of the cursor's line).
export function registerGitBlameHandlers(): void {
  const service = createGitBlameService({
    runGit: async (args, { cwd, stdin }) =>
      (await gitExecFileAsync(args, { cwd, stdin, admissionTier: 'interactive' })).stdout,
    ownerRepoFor: (worktreeRoot) => getOwnerRepo(worktreeRoot),
    fetchCommitPulls: (ownerRepo, sha) =>
      githubApi(ownerRepo, `repos/${ownerRepo.owner}/${ownerRepo.repo}/commits/${sha}/pulls`),
    fetchCommit: (ownerRepo, sha) =>
      githubApi(ownerRepo, `repos/${ownerRepo.owner}/${ownerRepo.repo}/commits/${sha}`),
    fetchViewerLogin: async (ownerRepo) => {
      const user = (await githubApi(ownerRepo, 'user')) as { login?: unknown } | null
      return typeof user?.login === 'string' ? user.login : ''
    }
  })
  ipcMain.handle('gitBlame:line', async (_event, args: unknown) => {
    const request = readBlameRequest(args)
    return request ? service.blameLine(request) : { ok: false, error: 'Invalid blame request.' }
  })
  ipcMain.handle('gitBlame:links', async (_event, args: unknown) => {
    const request = readLinksRequest(args)
    return request
      ? service.links(request)
      : { commitUrl: null, pullRequest: null, avatarUrl: null, authorIsViewer: false }
  })
}
