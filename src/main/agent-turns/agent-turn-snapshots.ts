import { randomUUID } from 'node:crypto'
import { copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { gitExecFileAsync } from '../git/runner'
import { AGENT_TURN_REF_PREFIX, AGENT_TURNS_KEPT, type AgentTurn } from '../../shared/agent-turns'

const SNAPSHOT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Orca',
  GIT_AUTHOR_EMAIL: 'orca@localhost',
  GIT_COMMITTER_NAME: 'Orca',
  GIT_COMMITTER_EMAIL: 'orca@localhost'
}
const SUBJECT_MAX = 72
const FIELD = '\u001f'
const RECORD = '\u001e'

type TurnDetails = Omit<AgentTurn, 'ref' | 'oid' | 'parentOid'>

async function git(worktreePath: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await gitExecFileAsync(args, {
    cwd: worktreePath,
    ...(env ? { env: { ...process.env, ...env } } : {})
  })
  return stdout.trim()
}

// Why a copied index: `git add -A` into a throwaway index captures untracked files without
// touching what the user staged, and the copy keeps git's stat cache so only changed files rehash.
async function writeWorktreeTree(worktreePath: string): Promise<string> {
  const indexPath = path.resolve(
    worktreePath,
    await git(worktreePath, ['rev-parse', '--git-path', 'index'])
  )
  const tempIndex = path.join(tmpdir(), `orca-turn-index-${randomUUID()}`)
  try {
    await copyFile(indexPath, tempIndex).catch(() => undefined)
    const env = { GIT_INDEX_FILE: tempIndex }
    await git(worktreePath, ['add', '-A', '--', '.'], env)
    return await git(worktreePath, ['write-tree'], env)
  } finally {
    await rm(tempIndex, { force: true })
  }
}

function commitTree(
  worktreePath: string,
  tree: string,
  message: string,
  parentOid?: string
): Promise<string> {
  return git(
    worktreePath,
    [
      '-c',
      'commit.gpgsign=false',
      'commit-tree',
      tree,
      ...(parentOid ? ['-p', parentOid] : []),
      '-m',
      message
    ],
    SNAPSHOT_IDENTITY
  )
}

export async function snapshotWorktree(worktreePath: string): Promise<string> {
  return commitTree(worktreePath, await writeWorktreeTree(worktreePath), 'orca turn start')
}

async function diffStats(
  worktreePath: string,
  from: string,
  to: string
): Promise<{ files: number; insertions: number; deletions: number }> {
  const numstat = await git(worktreePath, ['diff', '--numstat', '--no-renames', from, to])
  const stats = { files: 0, insertions: 0, deletions: 0 }
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [added, removed] = line.split('\t')
    stats.files++
    stats.insertions += Number(added) || 0
    stats.deletions += Number(removed) || 0
  }
  return stats
}

export async function recordAgentTurn(input: {
  worktreePath: string
  startOid: string
  prompt: string
  agent: string
  paneKey: string
  startedAt: number
  completedAt: number
  keep?: number
}): Promise<AgentTurn | null> {
  const { worktreePath, startOid } = input
  const tree = await writeWorktreeTree(worktreePath)
  const stats = await diffStats(worktreePath, startOid, tree)
  if (stats.files === 0) {
    return null
  }
  const details: TurnDetails = {
    prompt: input.prompt,
    agent: input.agent,
    paneKey: input.paneKey,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    ...stats
  }
  const subject = details.prompt.split('\n')[0].slice(0, SUBJECT_MAX) || 'agent turn'
  const oid = await commitTree(
    worktreePath,
    tree,
    `${subject}\n\n${JSON.stringify(details)}`,
    startOid
  )
  const ref = `${AGENT_TURN_REF_PREFIX}${String(input.completedAt).padStart(15, '0')}-${oid.slice(0, 8)}`
  await git(worktreePath, ['update-ref', ref, oid])
  await pruneAgentTurns(worktreePath, input.keep ?? AGENT_TURNS_KEPT)
  return { ref, oid, parentOid: startOid, ...details }
}

function parseTurn(record: string): AgentTurn | null {
  const [ref, oid, parentOid, body] = record.split(FIELD)
  if (!ref || !oid || !parentOid || !body) {
    return null
  }
  try {
    return { ref, oid, parentOid, ...(JSON.parse(body.slice(body.indexOf('{'))) as TurnDetails) }
  } catch {
    return null
  }
}

async function turnRefs(worktreePath: string, format: string): Promise<string> {
  const { stdout } = await gitExecFileAsync(
    ['for-each-ref', '--sort=-refname', `--format=${format}`, AGENT_TURN_REF_PREFIX],
    { cwd: worktreePath }
  )
  return stdout
}

export async function listAgentTurns(worktreePath: string): Promise<AgentTurn[]> {
  const output = await turnRefs(
    worktreePath,
    `%(refname)${FIELD}%(objectname)${FIELD}%(parent)${FIELD}%(contents:body)${RECORD}`
  )
  return output
    .split(RECORD)
    .map((record) => parseTurn(record.trim()))
    .filter((turn): turn is AgentTurn => turn !== null)
}

async function pruneAgentTurns(worktreePath: string, keep: number): Promise<void> {
  const refs = (await turnRefs(worktreePath, '%(refname)')).split('\n').filter(Boolean)
  for (const ref of refs.slice(keep)) {
    await git(worktreePath, ['update-ref', '-d', ref])
  }
}
