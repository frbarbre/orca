import { isAbsolute, relative, sep } from 'node:path'
import type {
  GitBlameCommit,
  GitBlameLinks,
  GitBlameLinksRequest,
  GitBlamePullRequest,
  GitBlameRequest,
  GitBlameResult
} from '../../shared/git-blame'

type OwnerRepo = { owner: string; repo: string; host?: string }

const UNCOMMITTED_SHA = /^0+$/
const SQUASH_PR_SUFFIX = /\s*\(#(\d+)\)\s*$/
const MAX_CACHED_PULLS = 500

function parsePorcelain(stdout: string): Omit<GitBlameCommit, 'isCurrentUser'> | null {
  const [header, ...rest] = stdout.split('\n')
  const sha = header?.split(' ')[0]
  if (!sha) {
    return null
  }
  const fields = new Map<string, string>()
  for (const line of rest) {
    if (line.startsWith('\t')) {
      break
    }
    const space = line.indexOf(' ')
    if (space > 0) {
      fields.set(line.slice(0, space), line.slice(space + 1))
    }
  }
  return {
    sha,
    summary: fields.get('summary') ?? '',
    authorName: fields.get('author') ?? '',
    authorEmail: (fields.get('author-mail') ?? '').replace(/^<|>$/g, ''),
    authorTime: Number(fields.get('author-time') ?? 0),
    committerName: fields.get('committer') ?? ''
  }
}

function pullRequestFromList(pulls: unknown): GitBlamePullRequest | null {
  if (!Array.isArray(pulls)) {
    return null
  }
  const valid = pulls.filter(
    (pull): pull is { number: number; title: string; html_url: string; merged_at?: unknown } =>
      typeof pull === 'object' &&
      pull !== null &&
      typeof pull.number === 'number' &&
      typeof pull.title === 'string' &&
      typeof pull.html_url === 'string'
  )
  const pull = valid.find((candidate) => candidate.merged_at) ?? valid[0]
  return pull ? { number: pull.number, title: pull.title, url: pull.html_url } : null
}

export function createGitBlameService({
  runGit,
  ownerRepoFor,
  fetchCommitPulls
}: {
  runGit: (args: string[], options: { cwd: string; stdin?: string }) => Promise<string>
  ownerRepoFor: (worktreeRoot: string) => Promise<OwnerRepo | null>
  fetchCommitPulls: (ownerRepo: OwnerRepo, sha: string) => Promise<unknown>
}): {
  blameLine: (request: GitBlameRequest) => Promise<GitBlameResult>
  links: (request: GitBlameLinksRequest) => Promise<GitBlameLinks>
} {
  const userEmails = new Map<string, Promise<string>>()
  const pullsBySha = new Map<string, GitBlamePullRequest | null>()

  const userEmail = (worktreeRoot: string): Promise<string> => {
    let email = userEmails.get(worktreeRoot)
    if (!email) {
      email = runGit(['config', 'user.email'], { cwd: worktreeRoot }).then(
        (stdout) => stdout.trim().toLowerCase(),
        () => ''
      )
      userEmails.set(worktreeRoot, email)
    }
    return email
  }

  const lookUpPull = async (ownerRepo: OwnerRepo, sha: string) => {
    if (pullsBySha.has(sha)) {
      return pullsBySha.get(sha) ?? null
    }
    try {
      const pull = pullRequestFromList(await fetchCommitPulls(ownerRepo, sha))
      if (pullsBySha.size >= MAX_CACHED_PULLS) {
        pullsBySha.clear()
      }
      pullsBySha.set(sha, pull)
      return pull
    } catch {
      return null
    }
  }

  return {
    blameLine: async ({ worktreeRoot, filePath, line, text }) => {
      const relativePath = relative(worktreeRoot, filePath)
      if (
        !isAbsolute(filePath) ||
        !relativePath ||
        relativePath.startsWith('..') ||
        isAbsolute(relativePath)
      ) {
        return { ok: false, error: 'Not a file in this worktree.' }
      }
      try {
        const stdout = await runGit(
          [
            'blame',
            '--porcelain',
            '-L',
            `${line},${line}`,
            '--contents',
            '-',
            '--',
            relativePath.split(sep).join('/')
          ],
          { cwd: worktreeRoot, stdin: text }
        )
        const commit = parsePorcelain(stdout)
        if (!commit) {
          return { ok: false, error: 'git blame returned nothing.' }
        }
        if (UNCOMMITTED_SHA.test(commit.sha)) {
          return { ok: true, blame: { uncommitted: true } }
        }
        const email = await userEmail(worktreeRoot)
        return {
          ok: true,
          blame: {
            uncommitted: false,
            commit: {
              ...commit,
              isCurrentUser: email !== '' && commit.authorEmail.toLowerCase() === email
            }
          }
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    links: async ({ worktreeRoot, sha, summary }) => {
      const ownerRepo = await ownerRepoFor(worktreeRoot).catch(() => null)
      if (!ownerRepo) {
        return { commitUrl: null, pullRequest: null }
      }
      const base = `https://${ownerRepo.host ?? 'github.com'}/${ownerRepo.owner}/${ownerRepo.repo}`
      // Why the summary first: a squash merge names its PR as "(#N)", which saves a GitHub call.
      const squash = summary.match(SQUASH_PR_SUFFIX)
      const pullRequest = squash
        ? {
            number: Number(squash[1]),
            title: summary.replace(SQUASH_PR_SUFFIX, ''),
            url: `${base}/pull/${squash[1]}`
          }
        : await lookUpPull(ownerRepo, sha)
      return { commitUrl: `${base}/commit/${sha}`, pullRequest }
    }
  }
}
