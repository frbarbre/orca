import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readPendingReviewDrafts, writePendingReviewDrafts } from './pending-review-draft-store'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pending-review-drafts-'))
  file = join(dir, 'pending-review-drafts.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function draft(id: string) {
  return { id, path: 'src/a.ts', line: 3, body: `note ${id}`, createdAt: 1 }
}

describe('the queued-comment file on this device', () => {
  it('reads as empty before anything was written', async () => {
    expect(await readPendingReviewDrafts(file)).toStrictEqual({})
  })

  it('keeps each workspace’s queue across a read', async () => {
    await writePendingReviewDrafts(file, 'repo::/w/one', [draft('a')])
    await writePendingReviewDrafts(file, 'repo::/w/two', [draft('b')])
    expect(await readPendingReviewDrafts(file)).toStrictEqual({
      'repo::/w/one': [draft('a')],
      'repo::/w/two': [draft('b')]
    })
  })

  it('forgets a workspace whose queue is emptied', async () => {
    await writePendingReviewDrafts(file, 'repo::/w/one', [draft('a')])
    await writePendingReviewDrafts(file, 'repo::/w/one', [])
    expect(await readPendingReviewDrafts(file)).toStrictEqual({})
  })

  // Why: each write rewrites the whole file, so two landing together would each write back a
  // copy that lacks the other's change.
  it('keeps both of two writes issued at once', async () => {
    await Promise.all([
      writePendingReviewDrafts(file, 'repo::/w/one', [draft('a')]),
      writePendingReviewDrafts(file, 'repo::/w/two', [draft('b')])
    ])
    expect(Object.keys(await readPendingReviewDrafts(file)).sort()).toStrictEqual([
      'repo::/w/one',
      'repo::/w/two'
    ])
  })

  it('treats a damaged file as empty rather than failing the review', async () => {
    await writeFile(file, '{ not json', 'utf8')
    expect(await readPendingReviewDrafts(file)).toStrictEqual({})
  })
})
