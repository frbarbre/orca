import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { Tab, TabGroup } from '../../../shared/tab-types'
import type { NotesSendAgentTarget } from './notes-send-agent-targets'
import { pickAutoSendTarget, type AutoSendTargetState } from './auto-send-target'

const WT = 'wt-1'

function terminalTarget(
  tabId: string,
  overrides: Partial<NotesSendAgentTarget> = {}
): NotesSendAgentTarget {
  return {
    paneKey: `${tabId}:leaf`,
    tabId,
    messageTarget: { kind: 'terminal', tabId, leafId: 'leaf' },
    agentType: 'claude',
    tabTitle: tabId,
    status: 'eligible',
    ...overrides
  }
}

function unifiedTab(id: string, entityId: string, groupId: string, extra: Partial<Tab> = {}): Tab {
  return {
    id,
    entityId,
    groupId,
    worktreeId: WT,
    contentType: 'terminal',
    label: id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...extra
  }
}

function group(id: string, activeTabId: string | null): TabGroup {
  return { id, worktreeId: WT, activeTabId, tabOrder: [] }
}

function status(updatedAt: number): AgentStatusEntry {
  return {
    state: 'done',
    prompt: '',
    updatedAt,
    stateStartedAt: updatedAt,
    paneKey: '',
    stateHistory: []
  }
}

function state(overrides: Partial<AutoSendTargetState> = {}): AutoSendTargetState {
  return {
    agentStatusByPaneKey: {},
    unifiedTabsByWorktree: {
      [WT]: [
        unifiedTab('u-a', 'term-a', 'g-1'),
        unifiedTab('u-b', 'term-b', 'g-1'),
        unifiedTab('u-c', 'term-c', 'g-2')
      ]
    },
    groupsByWorktree: { [WT]: [group('g-1', 'u-a'), group('g-2', 'u-c')] },
    layoutByWorktree: {
      [WT]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'g-1' },
        second: { type: 'leaf', groupId: 'g-2' }
      }
    },
    ...overrides
  }
}

describe('pickAutoSendTarget', () => {
  const targets = [terminalTarget('term-a'), terminalTarget('term-b'), terminalTarget('term-c')]

  it('picks the only session open in a tab, even when another was active more recently', () => {
    const onlyOneOpen = state({
      groupsByWorktree: { [WT]: [group('g-1', 'u-a'), group('g-2', null)] },
      agentStatusByPaneKey: {
        'term-a:leaf': status(100),
        'term-b:leaf': status(900),
        'term-c:leaf': status(500)
      }
    })
    expect(pickAutoSendTarget(targets, onlyOneOpen, WT)?.tabId).toBe('term-a')
  })

  it('picks the most recently active of several sessions open in tabs', () => {
    const both = state({
      agentStatusByPaneKey: {
        'term-a:leaf': status(100),
        'term-b:leaf': status(900),
        'term-c:leaf': status(500)
      }
    })
    expect(pickAutoSendTarget(targets, both, WT)?.tabId).toBe('term-c')
  })

  it('falls back to the most recently active session when none is open in a tab', () => {
    const noneOpen = state({
      groupsByWorktree: { [WT]: [group('g-1', 'other'), group('g-2', null)] },
      agentStatusByPaneKey: {
        'term-a:leaf': status(100),
        'term-b:leaf': status(900),
        'term-c:leaf': status(500)
      }
    })
    expect(pickAutoSendTarget(targets, noneOpen, WT)?.tabId).toBe('term-b')
  })

  it('ignores sessions that cannot take notes', () => {
    const withDisabled = [
      terminalTarget('term-a', { status: 'disabled', disabledReason: 'Waiting for permission' }),
      terminalTarget('term-b')
    ]
    expect(pickAutoSendTarget(withDisabled, state(), WT)?.tabId).toBe('term-b')
  })

  it('does not count a group outside the window layout as open', () => {
    const hiddenGroup = state({
      layoutByWorktree: { [WT]: { type: 'leaf', groupId: 'g-2' } },
      agentStatusByPaneKey: { 'term-a:leaf': status(900), 'term-c:leaf': status(100) }
    })
    expect(pickAutoSendTarget(targets, hiddenGroup, WT)?.tabId).toBe('term-c')
  })

  it('matches a structured chat by its own tab id', () => {
    const chat: NotesSendAgentTarget = {
      paneKey: 'chat-pane',
      tabId: 'u-chat',
      messageTarget: { kind: 'structured-session', sessionId: 'session-1' },
      agentType: 'codex',
      tabTitle: 'Chat',
      status: 'eligible'
    }
    const chatOpen = state({
      unifiedTabsByWorktree: {
        [WT]: [unifiedTab('u-chat', 'session-1', 'g-1', { contentType: 'agent-session' })]
      },
      groupsByWorktree: { [WT]: [group('g-1', 'u-chat')] },
      layoutByWorktree: { [WT]: { type: 'leaf', groupId: 'g-1' } }
    })
    expect(pickAutoSendTarget([terminalTarget('term-a'), chat], chatOpen, WT)?.paneKey).toBe(
      'chat-pane'
    )
  })

  it('picks nothing when no session can take notes', () => {
    expect(pickAutoSendTarget([], state(), WT)).toBeNull()
    expect(
      pickAutoSendTarget([terminalTarget('term-a', { status: 'disabled' })], state(), WT)
    ).toBeNull()
  })
})
