import { open, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute } from 'node:path'

const MAX_READ_BYTES = 4 * 1024 * 1024
const MAX_ENTRIES = 10_000
const META = 0x83
const EXTENDED_PREFIX = /^: \d+:\d+;/
const HISTORY_NAME = /hist/i

function unmetafy(buffer: Buffer): Buffer {
  const out = Buffer.alloc(buffer.length)
  let length = 0
  for (let index = 0; index < buffer.length; index++) {
    const byte = buffer[index]
    out[length++] = byte === META && index + 1 < buffer.length ? buffer[++index] ^ 32 : byte
  }
  return out.subarray(0, length)
}

/** Commands oldest first, each kept only at its latest position. */
export function parseZshHistory(buffer: Buffer): string[] {
  const lines = unmetafy(buffer).toString('utf8').split('\n')
  const entries: string[] = []
  let pending: string[] = []
  for (const line of lines) {
    if (line.endsWith('\\')) {
      pending.push(line.slice(0, -1))
      continue
    }
    const command = [...pending, line].join('\n').replace(EXTENDED_PREFIX, '')
    pending = []
    if (command.trim()) {
      entries.push(command)
    }
  }
  const seen = new Set<string>()
  const latestFirst: string[] = []
  for (let index = entries.length - 1; index >= 0 && latestFirst.length < MAX_ENTRIES; index--) {
    if (!seen.has(entries[index])) {
      seen.add(entries[index])
      latestFirst.push(entries[index])
    }
  }
  return latestFirst.toReversed()
}

// Why: the path comes from the renderer, so only a regular file that is named like a history file is read.
export async function readZshHistory(path: string): Promise<string[]> {
  try {
    if (!isAbsolute(path) || !HISTORY_NAME.test(basename(path))) {
      return []
    }
    const resolved = await realpath(path)
    const info = await stat(resolved)
    if (!info.isFile() || !HISTORY_NAME.test(basename(resolved))) {
      return []
    }
    const handle = await open(resolved, 'r')
    try {
      const length = Math.min(info.size, MAX_READ_BYTES)
      const buffer = Buffer.alloc(length)
      await handle.read(buffer, 0, length, info.size - length)
      // A cut-off first line is a partial entry, so it is dropped.
      const start = length < info.size ? buffer.indexOf(0x0a) + 1 : 0
      return parseZshHistory(buffer.subarray(start))
    } finally {
      await handle.close()
    }
  } catch {
    return []
  }
}
