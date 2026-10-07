import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import { sendNotesToActiveAgentSession } from './active-agent-note-send'
import {
  createNoteSendAppState,
  OTHER_LEAF_ID,
  type NoteSendAppState
} from './active-agent-note-send-test-harness'

const CLAUDE_SEND_NOW = '\x18\x13'

const testState = vi.hoisted(() => {
  const state: {
    appState?: NoteSendAppState
    callRuntimeRpc: ReturnType<typeof vi.fn>
    getActiveRuntimeTarget: ReturnType<typeof vi.fn>
    RuntimeRpcCallError: new (message?: string) => Error
  } = {
    callRuntimeRpc: vi.fn(),
    getActiveRuntimeTarget: vi.fn(() => ({ kind: 'local' })),
    RuntimeRpcCallError: class RuntimeRpcCallError extends Error {}
  }
  return state
})

vi.mock('@/store', () => ({
  useAppStore: { getState: () => testState.appState }
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: testState.callRuntimeRpc,
  getActiveRuntimeTarget: testState.getActiveRuntimeTarget,
  RuntimeRpcCallError: testState.RuntimeRpcCallError
}))

function agentEntry(agentType: AgentStatusEntry['agentType']): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: `tab-9:${OTHER_LEAF_ID}`,
    stateHistory: [],
    agentType
  }
}

function runtimeWith(agentState: 'working' | 'idle'): unknown[] {
  const sentTexts: unknown[] = []
  testState.callRuntimeRpc.mockImplementation(async (_target, method, params) => {
    if (method === 'terminal.list') {
      return {
        terminals: [
          {
            handle: 'term-2',
            worktreeId: 'wt-1',
            worktreePath: '/repo',
            branch: 'main',
            tabId: 'tab-9',
            leafId: OTHER_LEAF_ID,
            title: 'Agent',
            connected: true,
            writable: true,
            lastOutputAt: 1,
            preview: ''
          }
        ],
        totalCount: 1,
        truncated: false
      }
    }
    if (method === 'terminal.agentStatus') {
      return { agentStatus: { handle: 'term-2', isRunningAgent: true, status: agentState } }
    }
    if (method === 'terminal.send') {
      sentTexts.push(params.enter ? 'Enter' : params.text)
      return { send: { handle: 'term-2', accepted: true, bytesWritten: 1 } }
    }
    throw new Error(`unexpected method ${method}`)
  })
  return sentTexts
}

async function send(): Promise<unknown> {
  return sendNotesToActiveAgentSession({
    worktreeId: 'wt-1',
    prompt: 'notes',
    noteTarget: { tabId: 'tab-9', leafId: OTHER_LEAF_ID }
  })
}

describe('explicit note send to a busy agent', () => {
  beforeEach(() => {
    testState.callRuntimeRpc.mockReset()
  })

  function paneRuns(agentType: AgentStatusEntry['agentType']): void {
    testState.appState = {
      ...createNoteSendAppState(),
      agentStatusByPaneKey: { [`tab-9:${OTHER_LEAF_ID}`]: agentEntry(agentType) }
    }
  }

  it('tells a working Claude Code to take the note now instead of queueing it', async () => {
    paneRuns('claude')
    const sentTexts = runtimeWith('working')

    await expect(send()).resolves.toEqual({ status: 'sent' })
    expect(sentTexts.slice(1)).toEqual(['Enter', CLAUDE_SEND_NOW])
  })

  it('submits normally when Claude Code is idle', async () => {
    paneRuns('claude')
    const sentTexts = runtimeWith('idle')

    await send()
    expect(sentTexts.slice(1)).toEqual(['Enter'])
  })

  it('leaves other agents to their own queue', async () => {
    paneRuns('codex')
    const sentTexts = runtimeWith('working')

    await send()
    expect(sentTexts.slice(1)).toEqual(['Enter'])
  })
})
