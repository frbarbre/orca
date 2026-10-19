import { describe, expect, it, vi } from 'vitest'
import {
  findTerminalCandidates,
  runQuickCommand,
  type RunQuickCommandDeps
} from './run-quick-command'

function layout(ptyId: string) {
  return {
    root: null,
    activeLeafId: 'leaf',
    expandedLeafId: null,
    ptyIdsByLeafId: { leaf: ptyId }
  }
}

const state = {
  groupsByWorktree: {
    'wt-1': [
      { id: 'group-1', activeTabId: 'unified-1' },
      { id: 'group-2', activeTabId: 'unified-2' }
    ]
  },
  unifiedTabsByWorktree: {
    'wt-1': [
      { id: 'unified-3', entityId: 'term-3', contentType: 'terminal', groupId: 'group-2' },
      { id: 'unified-1', entityId: 'term-1', contentType: 'terminal', groupId: 'group-1' },
      { id: 'unified-2', entityId: 'editor-1', contentType: 'editor', groupId: 'group-2' },
      { id: 'unified-4', entityId: 'term-4', contentType: 'terminal', groupId: 'group-1' },
      { id: 'unified-5', entityId: 'term-5', contentType: 'terminal', groupId: 'group-1' }
    ]
  },
  terminalLayoutsByTabId: {
    'term-1': layout('pty-1'),
    'term-3': layout('pty-3'),
    'term-4': layout('pty-4')
  }
} as never

describe('findTerminalCandidates', () => {
  it("lists the group's shown terminal, then its hidden ones, then the worktree's other terminals", () => {
    expect(findTerminalCandidates(state, 'wt-1', 'group-1')).toEqual([
      { tabId: 'unified-1', ptyId: 'pty-1', groupId: 'group-1' },
      { tabId: 'unified-4', ptyId: 'pty-4', groupId: 'group-1' },
      { tabId: 'unified-3', ptyId: 'pty-3', groupId: 'group-2' }
    ])
  })

  it('lists hidden terminals when the group shows something else', () => {
    expect(findTerminalCandidates(state, 'wt-1', 'group-2')).toEqual([
      { tabId: 'unified-3', ptyId: 'pty-3', groupId: 'group-2' },
      { tabId: 'unified-1', ptyId: 'pty-1', groupId: 'group-1' },
      { tabId: 'unified-4', ptyId: 'pty-4', groupId: 'group-1' }
    ])
  })
})

const candidates = [
  { tabId: 'unified-1', ptyId: 'pty-1', groupId: 'group-1' },
  { tabId: 'unified-4', ptyId: 'pty-4', groupId: 'group-1' },
  { tabId: 'unified-3', ptyId: 'pty-3', groupId: 'group-2' }
]

type Verdict = 'live' | 'exited' | 'unverifiable'

function deps(verdicts: Verdict[]): RunQuickCommandDeps {
  return {
    findTargets: () => candidates,
    probe: vi.fn(async (ptyIds: readonly string[]) => ptyIds.map((_, i) => verdicts[i] ?? 'live')),
    write: vi.fn(() => true),
    showTab: vi.fn(),
    rememberRun: vi.fn(),
    runInNewTab: vi.fn()
  }
}

const command = {
  id: 'c1',
  label: 'Dev',
  action: 'terminal-command',
  command: 'pnpm dev'
} as never
const args = { command, worktreeId: 'wt-1', groupId: 'group-1', historyId: 'h1' }

describe('runQuickCommand', () => {
  it('runs in the shown terminal when nothing runs there', async () => {
    const d = deps(['exited', 'exited', 'exited'])
    await runQuickCommand(args, d)
    expect(d.write).toHaveBeenCalledWith('pty-1', 'pnpm dev\r')
    expect(d.showTab).toHaveBeenCalledWith('unified-1')
    expect(d.rememberRun).toHaveBeenCalledWith('group-1', 'h1')
    expect(d.runInNewTab).not.toHaveBeenCalled()
  })

  it('runs in an idle terminal tab that is not shown, and shows it', async () => {
    const d = deps(['live', 'unverifiable', 'exited'])
    await runQuickCommand(args, d)
    expect(d.probe).toHaveBeenCalledWith(['pty-1', 'pty-4', 'pty-3'])
    expect(d.write).toHaveBeenCalledTimes(1)
    expect(d.write).toHaveBeenCalledWith('pty-3', 'pnpm dev\r')
    expect(d.showTab).toHaveBeenCalledWith('unified-3')
    expect(d.rememberRun).toHaveBeenCalledWith('group-2', 'h1')
  })

  it('opens a new terminal when every terminal is busy, or cannot be told', async () => {
    const d = deps(['live', 'unverifiable', 'live'])
    await runQuickCommand(args, d)
    expect(d.write).not.toHaveBeenCalled()
    expect(d.runInNewTab).toHaveBeenCalledWith(args)
  })

  it('opens a new tab for an agent prompt, as before', async () => {
    const d = deps(['exited'])
    const agentCommand = {
      ...args,
      command: { ...(command as object), action: 'agent-prompt', agent: 'claude', prompt: 'hi' }
    } as never
    await runQuickCommand(agentCommand, d)
    expect(d.probe).not.toHaveBeenCalled()
    expect(d.runInNewTab).toHaveBeenCalled()
  })
})
