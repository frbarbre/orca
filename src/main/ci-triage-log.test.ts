import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCiTriageLog } from './ci-triage-log'

const entry = {
  at: '2026-10-29T11:19:47.395Z',
  window: '2026-10-29T11:19:30.000Z',
  decision: 'started' as const,
  trigger: 'watch' as const,
  repoId: 'repo-1',
  prNumber: 3729,
  branch: 'e-6359',
  headSha: '6a9bb115',
  failed: [{ name: 'checks', url: 'https://x/runs/1' }]
}

let dir: string | null = null

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true })
  }
  dir = null
})

describe('createCiTriageLog', () => {
  it('appends each decision as a JSON line with the app process and version that wrote it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ci-triage-log-'))
    const log = createCiTriageLog({
      filePath: join(dir, 'logs', 'ci-triage.jsonl'),
      version: '1.4.449'
    })

    await log.record(entry)
    await log.record({ ...entry, decision: 'launched' })

    const lines = (await readFile(join(dir, 'logs', 'ci-triage.jsonl'), 'utf8')).trim().split('\n')
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { ...entry, pid: process.pid, version: '1.4.449' },
      { ...entry, decision: 'launched', pid: process.pid, version: '1.4.449' }
    ])
  })

  it('starts a new file past its size, keeping the previous one beside it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ci-triage-log-'))
    const filePath = join(dir, 'ci-triage.jsonl')
    const log = createCiTriageLog({ filePath, version: '1', maxBytes: 400 })

    for (let index = 0; index < 3; index++) {
      await log.record({ ...entry, prNumber: index })
    }

    const current = (await readFile(filePath, 'utf8')).trim().split('\n')
    const previous = (await readFile(`${filePath}.1`, 'utf8')).trim().split('\n')
    expect(current.map((line) => JSON.parse(line).prNumber)).toEqual([2])
    expect(previous.map((line) => JSON.parse(line).prNumber)).toEqual([1])
  })
})
