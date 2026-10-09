export type GitBlameCommit = {
  sha: string
  summary: string
  authorName: string
  authorEmail: string
  /** Unix seconds. */
  authorTime: number
  committerName: string
  isCurrentUser: boolean
}

export type GitBlameLine = { uncommitted: true } | { uncommitted: false; commit: GitBlameCommit }

export type GitBlameRequest = {
  worktreeRoot: string
  filePath: string
  /** One-based. */
  line: number
  text: string
}

export type GitBlameResult = { ok: true; blame: GitBlameLine } | { ok: false; error: string }

export type GitBlameLinksRequest = { worktreeRoot: string; sha: string; summary: string }

export type GitBlamePullRequest = { number: number; title: string; url: string }

export type GitBlameLinks = { commitUrl: string | null; pullRequest: GitBlamePullRequest | null }
