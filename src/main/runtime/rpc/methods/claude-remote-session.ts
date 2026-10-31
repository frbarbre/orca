import { ClaudeRemoteSessionResolveUrl } from '../../../../shared/rpc-contract/claude-remote-session-params'
import { resolveClaudeRemoteSessionUrl } from '../../../claude/claude-remote-session-url'
import { defineMethod } from '../core'

export const CLAUDE_REMOTE_SESSION_METHODS = [
  defineMethod({
    name: 'claudeRemoteSession.resolveUrl',
    permission: 'workspace',
    params: ClaudeRemoteSessionResolveUrl,
    handler: (params) => resolveClaudeRemoteSessionUrl(params.sessionId)
  })
]
