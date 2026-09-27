import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  normalizePendingReviewComments,
  type PendingReviewComment
} from '../../shared/github/pending-review-comment'

export type PendingReviewDrafts = Record<string, PendingReviewComment[]>

const FILE_VERSION = 1

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

/** A missing or unreadable file is an empty queue, never an error the reviewer has to clear. */
export async function readPendingReviewDrafts(file: string): Promise<PendingReviewDrafts> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return {}
  }
  const drafts = asRecord(asRecord(parsed)?.drafts)
  if (!drafts) {
    return {}
  }
  const result: PendingReviewDrafts = {}
  for (const [worktreeId, comments] of Object.entries(drafts)) {
    const normalized = normalizePendingReviewComments(comments)
    if (normalized.length > 0) {
      result[worktreeId] = normalized
    }
  }
  return result
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Replaces one workspace's queue on disk.
 *
 * Why serialized: every write is a read-modify-write of the whole file, and two edits landing
 * together would otherwise each write back the other's stale copy. Why a rename: a crash mid-write
 * must leave the previous file, not half of the new one.
 */
export function writePendingReviewDrafts(
  file: string,
  worktreeId: string,
  comments: readonly PendingReviewComment[]
): Promise<void> {
  const run = queue.then(async () => {
    const drafts = await readPendingReviewDrafts(file)
    const normalized = normalizePendingReviewComments(comments)
    if (normalized.length > 0) {
      drafts[worktreeId] = normalized
    } else {
      delete drafts[worktreeId]
    }
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify({ version: FILE_VERSION, drafts }), 'utf8')
    await rename(temp, file)
  })
  queue = run.catch(() => undefined)
  return run
}
