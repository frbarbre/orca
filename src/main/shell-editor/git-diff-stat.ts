import { execFile } from 'node:child_process'
import { open } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const GIT_TIMEOUT_MS = 3000
const MAX_UNTRACKED_FILES = 500
const MAX_UNTRACKED_BYTES = 2 * 1024 * 1024

export type GitDiffStat = { files: number; insertions: number; deletions: number }

export function parseShortstat(text: string): GitDiffStat {
  const count = (pattern: RegExp): number => Number(pattern.exec(text)?.[1] ?? 0)
  return {
    files: count(/(\d+) files? changed/),
    insertions: count(/(\d+) insertions?\(\+\)/),
    deletions: count(/(\d+) deletions?\(-\)/)
  }
}

// Why fsmonitor off: the folder is wherever the user cd'd, and its config must not get to run a command.
function git(cwd: string, args: string[]): Promise<string> {
  return run('git', ['-c', 'core.fsmonitor=false', '-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024
  }).then((result) => result.stdout)
}

async function countLines(path: string): Promise<number> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(MAX_UNTRACKED_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, MAX_UNTRACKED_BYTES, 0)
    if (bytesRead === 0 || buffer.subarray(0, Math.min(bytesRead, 8000)).includes(0)) {
      return 0
    }
    let lines = 0
    for (let index = 0; index < bytesRead; index++) {
      if (buffer[index] === 0x0a) {
        lines++
      }
    }
    return buffer[bytesRead - 1] === 0x0a ? lines : lines + 1
  } finally {
    await handle.close()
  }
}

/** Changes against HEAD, counting untracked files and their lines as Warp does; null outside a repo. */
export async function readGitDiffStat(cwd: string): Promise<GitDiffStat | null> {
  if (!isAbsolute(cwd)) {
    return null
  }
  let root: string
  try {
    root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim()
  } catch {
    return null
  }
  const tracked = await git(cwd, ['diff', '--shortstat', 'HEAD']).then(parseShortstat, () => ({
    files: 0,
    insertions: 0,
    deletions: 0
  }))
  const untracked = await git(cwd, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--full-name',
    ':/'
  ])
    .then((out) => out.split('\0').filter(Boolean))
    .catch(() => [] as string[])
  let untrackedLines = 0
  for (const file of untracked.slice(0, MAX_UNTRACKED_FILES)) {
    untrackedLines += await countLines(join(root, file)).catch(() => 0)
  }
  return {
    files: tracked.files + untracked.length,
    insertions: tracked.insertions + untrackedLines,
    deletions: tracked.deletions
  }
}
