import type { ClaudeRemoteSessionUrlResult } from '../../../../shared/claude-remote-session'
import { parseExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'

// Why the paired Orca answers: Claude Code writes the session's process files on its own machine.
export function resolveClaudeRemoteSessionUrlForHost(
  sessionId: string,
  hostId: ExecutionHostId | null
): Promise<ClaudeRemoteSessionUrlResult> {
  const host = parseExecutionHostId(hostId)
  if (host?.kind === 'runtime') {
    return callRuntimeRpc<ClaudeRemoteSessionUrlResult>(
      { kind: 'environment', environmentId: host.environmentId },
      'claudeRemoteSession.resolveUrl',
      { sessionId }
    )
  }
  return window.api.claudeRemoteSession.resolveUrl({ sessionId, ...(hostId ? { hostId } : {}) })
}
