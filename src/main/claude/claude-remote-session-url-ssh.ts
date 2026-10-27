import type { ClaudeRemoteSessionUrlResult } from '../../shared/claude-remote-session'
import { quotePosixShell } from '../../shared/shell-argument-quoting'
import { execCommand } from '../ssh/remote-exec/remote-exec-command'
import { knownSshHostPlatform } from '../ssh/ssh-host-platform-memo'
import { getSshConnectionManager } from '../ssh/targets/ssh-target-registry'
import { resolveClaudeRemoteSessionUrlFromRecords } from './claude-remote-session-url'

const RECORD_SEPARATOR = '--orca-claude-session-record--'

// Why grep first: only the process files naming this session are printed, not every live one.
function readSessionRecordsCommand(sessionId: string): string {
  const dir = '"${CLAUDE_CONFIG_DIR:-$HOME/.claude}/sessions"'
  return [
    `for f in $(grep -l -F -- ${quotePosixShell(sessionId)} ${dir}/*.json 2>/dev/null); do`,
    `cat "$f"; echo; echo ${RECORD_SEPARATOR};`,
    'done'
  ].join(' ')
}

/** The claude.ai link of a Claude Code session running on an SSH host, read from that host. */
export async function resolveSshClaudeRemoteSessionUrl(
  targetId: string,
  sessionId: string
): Promise<ClaudeRemoteSessionUrlResult> {
  const connection = getSshConnectionManager()?.getConnection(targetId)
  // Why: the lookup is a POSIX shell script; a Windows host keeps its sessions out of reach.
  if (!connection || knownSshHostPlatform(targetId)?.os === 'win32') {
    return { status: 'session-not-found' }
  }
  try {
    const output = await execCommand(connection, readSessionRecordsCommand(sessionId), {
      timeoutMs: 10_000
    })
    return resolveClaudeRemoteSessionUrlFromRecords(sessionId, output.split(RECORD_SEPARATOR))
  } catch {
    return { status: 'session-not-found' }
  }
}
