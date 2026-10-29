import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { CiTriageLogEntry } from '../shared/ci-triage-log'

/**
 * Fork: every CI triage decision as one JSON line, so a doubled or missing triage agent can be
 * traced to the look that started it. The previous file is kept as `<file>.1` past `maxBytes`.
 */
export function createCiTriageLog({
  filePath,
  version,
  maxBytes = 2 * 1024 * 1024
}: {
  filePath: string
  version: string
  maxBytes?: number
}): { record: (entry: CiTriageLogEntry & { at: string; window: string }) => Promise<void> } {
  let chain: Promise<void> = Promise.resolve()
  let bytes: number | null = null
  return {
    record: (entry) => {
      const write = chain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true })
        const line = `${JSON.stringify({ ...entry, pid: process.pid, version })}\n`
        bytes ??= await stat(filePath).then(
          (file) => file.size,
          () => 0
        )
        const lineBytes = Buffer.byteLength(line, 'utf8')
        if (bytes > 0 && bytes + lineBytes > maxBytes) {
          await rm(`${filePath}.1`, { force: true })
          await rename(filePath, `${filePath}.1`).catch(() => {})
          bytes = 0
        }
        await appendFile(filePath, line, 'utf8')
        bytes += lineBytes
      })
      // Why: one failed write must not stop the ones after it.
      chain = write.catch(() => {})
      return write
    }
  }
}
