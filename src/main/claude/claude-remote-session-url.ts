import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ClaudeRemoteSessionUrlResult } from '../../shared/claude-remote-session'
import { defaultClaudeConfigDir } from './claude-config-dir-pin'

const BRIDGE_SESSION_ID_PATTERN = /^session_[A-Za-z0-9]+$/

type ClaudeProcessSessionRecord = {
  sessionId: string
  bridgeSessionId: string | null
  updatedAt: number
}

function parseProcessSessionRecord(raw: string): ClaudeProcessSessionRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const sessionId = 'sessionId' in parsed ? parsed.sessionId : undefined
  if (typeof sessionId !== 'string') {
    return null
  }
  const bridge = 'bridgeSessionId' in parsed ? parsed.bridgeSessionId : undefined
  const updatedAt = 'updatedAt' in parsed ? parsed.updatedAt : undefined
  return {
    sessionId,
    bridgeSessionId:
      typeof bridge === 'string' && BRIDGE_SESSION_ID_PATTERN.test(bridge) ? bridge : null,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : 0
  }
}

// Why: Claude Code writes one `sessions/<pid>.json` per live process; `bridgeSessionId` is the
// Remote Control session claude.ai serves. A resumed session can leave several files behind, so
// the most recently updated one wins.
export async function resolveClaudeRemoteSessionUrl(
  sessionId: string,
  configDir: string = defaultClaudeConfigDir()
): Promise<ClaudeRemoteSessionUrlResult> {
  const sessionsDir = join(configDir, 'sessions')
  let names: string[]
  try {
    names = await readdir(sessionsDir)
  } catch {
    return { status: 'session-not-found' }
  }
  let match: ClaudeProcessSessionRecord | null = null
  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue
    }
    const record = await readFile(join(sessionsDir, name), 'utf8')
      .then(parseProcessSessionRecord)
      .catch(() => null)
    if (record?.sessionId === sessionId && (!match || record.updatedAt > match.updatedAt)) {
      match = record
    }
  }
  if (!match) {
    return { status: 'session-not-found' }
  }
  if (!match.bridgeSessionId) {
    return { status: 'remote-control-off' }
  }
  return { status: 'ready', url: `https://claude.ai/code/${match.bridgeSessionId}` }
}
