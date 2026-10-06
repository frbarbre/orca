import { afterEach, describe, expect, it } from 'vitest'
import type { AgentStatusEntry, AgentType } from '../../../../shared/agent-status-types'
import {
  findClaudeWebLeafId,
  claudeWebView,
  resolvePaneClaudeSessionId
} from './claude-web-view-state'
import type { PaneAgentSessionIdState } from './pane-agent-session-id'

const CLAUDE_LEAF = '11111111-1111-4111-8111-111111111111'
const CODEX_LEAF = '22222222-2222-4222-8222-222222222222'

function entry(paneKey: string, agentType: AgentType, sessionId: string): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey,
    agentType,
    stateHistory: [],
    providerSession: { key: 'session_id', id: sessionId }
  }
}

function state(shellForegroundClaude = false): PaneAgentSessionIdState {
  const claudeKey = `tab-1:${CLAUDE_LEAF}`
  const codexKey = `tab-1:${CODEX_LEAF}`
  return {
    agentStatusByPaneKey: {
      [codexKey]: entry(codexKey, 'codex', 'codex-session'),
      [claudeKey]: entry(claudeKey, 'claude', 'claude-session')
    },
    sleepingAgentSessionsByPaneKey: {},
    paneForegroundAgentByPaneKey: {
      [claudeKey]: { agent: 'claude', shellForeground: shellForegroundClaude }
    }
  }
}

describe('findClaudeWebLeafId', () => {
  it('finds the Claude leaf of a split tab and ignores other agents', () => {
    expect(findClaudeWebLeafId(state(), 'tab-1')).toBe(CLAUDE_LEAF)
    expect(findClaudeWebLeafId(state(), 'tab-2')).toBeNull()
  })

  it('only accepts a preferred leaf that runs Claude', () => {
    expect(findClaudeWebLeafId(state(), 'tab-1', CLAUDE_LEAF)).toBe(CLAUDE_LEAF)
    expect(findClaudeWebLeafId(state(), 'tab-1', CODEX_LEAF)).toBeNull()
  })

  it('ignores a Claude pane that has exited back to the shell', () => {
    expect(findClaudeWebLeafId(state(true), 'tab-1')).toBeNull()
  })
})

describe('resolvePaneClaudeSessionId', () => {
  it('returns the session id only for Claude panes', () => {
    expect(resolvePaneClaudeSessionId(state(), `tab-1:${CLAUDE_LEAF}`)).toBe('claude-session')
    expect(resolvePaneClaudeSessionId(state(), `tab-1:${CODEX_LEAF}`)).toBeNull()
  })
})

describe('claudeWebView', () => {
  afterEach(() => {
    claudeWebView.hide('tab-1')
    claudeWebView.hide('tab-2')
  })

  it('shows and hides the web view per tab', () => {
    claudeWebView.show('tab-1', CLAUDE_LEAF)
    claudeWebView.show('tab-2', CODEX_LEAF)
    claudeWebView.hide('tab-1')
    expect(claudeWebView.leafIdFor('tab-1')).toBeNull()
    expect(claudeWebView.leafIdFor('tab-2')).toBe(CODEX_LEAF)
  })
})
