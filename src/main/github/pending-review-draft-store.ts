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

type DraftFile = { drafts: PendingReviewDrafts; summaries: Record<string, string> }

/** A missing or unreadable file is empty, never an error the reviewer has to clear. */
async function readDraftFile(file: string): Promise<DraftFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return { drafts: {}, summaries: {} }
  }
  const root = asRecord(parsed)
  const drafts: PendingReviewDrafts = {}
  for (const [worktreeId, comments] of Object.entries(asRecord(root?.drafts) ?? {})) {
    const normalized = normalizePendingReviewComments(comments)
    if (normalized.length > 0) {
      drafts[worktreeId] = normalized
    }
  }
  const summaries: Record<string, string> = {}
  for (const [worktreeId, text] of Object.entries(asRecord(root?.summaries) ?? {})) {
    if (typeof text === 'string' && text.trim()) {
      summaries[worktreeId] = text
    }
  }
  return { drafts, summaries }
}

export async function readPendingReviewDrafts(file: string): Promise<PendingReviewDrafts> {
  return (await readDraftFile(file)).drafts
}

/** Each workspace's unsent review summary, kept beside its queued comments. */
export async function readPendingReviewSummaries(file: string): Promise<Record<string, string>> {
  return (await readDraftFile(file)).summaries
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Rewrites the file with one change applied.
 *
 * Why serialized: every write is a read-modify-write of the whole file, and two edits landing
 * together would otherwise each write back the other's stale copy. Why a rename: a crash mid-write
 * must leave the previous file, not half of the new one.
 */
function updateDraftFile(file: string, change: (current: DraftFile) => void): Promise<void> {
  const run = queue.then(async () => {
    const current = await readDraftFile(file)
    change(current)
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify({ version: FILE_VERSION, ...current }), 'utf8')
    await rename(temp, file)
  })
  queue = run.catch(() => undefined)
  return run
}

/** Replaces one workspace's queue on disk. */
export function writePendingReviewDrafts(
  file: string,
  worktreeId: string,
  comments: readonly PendingReviewComment[]
): Promise<void> {
  return updateDraftFile(file, ({ drafts }) => {
    const normalized = normalizePendingReviewComments(comments)
    if (normalized.length > 0) {
      drafts[worktreeId] = normalized
    } else {
      delete drafts[worktreeId]
    }
  })
}

/** Replaces one workspace's unsent review summary on disk; an empty one is removed. */
export function writePendingReviewSummary(
  file: string,
  worktreeId: string,
  text: string
): Promise<void> {
  return updateDraftFile(file, ({ summaries }) => {
    if (text.trim()) {
      summaries[worktreeId] = text
    } else {
      delete summaries[worktreeId]
    }
  })
}
