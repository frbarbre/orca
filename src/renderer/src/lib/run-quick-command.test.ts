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

function target(n: number, groupId: string, quickCommandLabel: string | null = null) {
  return {
    tabId: `unified-${n}`,
    terminalId: `term-${n}`,
    paneKey: `term-${n}:leaf`,
    ptyId: `pty-${n}`,
    groupId,
    quickCommandLabel
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
      {
        id: 'unified-3',
        entityId: 'term-3',
        contentType: 'terminal',
        groupId: 'group-2',
        quickCommandLabel: 'Dev'
      },
      { id: 'unified-1', entityId: 'term-1', contentType: 'terminal', groupId: 'group-1' },
      { id: 'unified-2', entityId: 'editor-1', contentType: 'editor', groupId: 'group-2' },
      { id: 'unified-4', entityId: 'term-4', contentType: 'terminal', groupId: 'group-1' },
      { id: 'unified-5', entityId: 'term-5', contentType: 'terminal', groupId: 'group-1' }
    ]
  },
  tabsByWorktree: {
    'wt-1': [{ id: 'term-4', quickCommandLabel: 'Tests' }]
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
      target(1, 'group-1'),
      target(4, 'group-1', 'Tests'),
      target(3, 'group-2', 'Dev')
    ])
  })

  it('lists hidden terminals when the group shows something else', () => {
    expect(findTerminalCandidates(state, 'wt-1', 'group-2')).toEqual([
      target(3, 'group-2', 'Dev'),
      target(1, 'group-1'),
      target(4, 'group-1', 'Tests')
    ])
  })
})

type Verdict = 'live' | 'exited' | 'unverifiable'

function deps(
  verdicts: Verdict[],
  candidates = [target(1, 'group-1'), target(4, 'group-1'), target(3, 'group-2')],
  running: Record<string, string> = {}
): RunQuickCommandDeps {
  return {
    findTargets: () => candidates,
    probe: vi.fn(async (ptyIds: readonly string[]) => ptyIds.map((_, i) => verdicts[i] ?? 'live')),
    write: vi.fn(() => true),
    nameTab: vi.fn(),
    ringBell: vi.fn(),
    rememberRun: vi.fn(),
    runningIn: (terminalId) => running[terminalId] ?? null,
    track: vi.fn(),
    runInNewTab: vi.fn(() => 'term-9')
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
  it('runs in the shown terminal when nothing runs there, naming it after the command', async () => {
    const d = deps(['exited', 'exited', 'exited'])
    await runQuickCommand(args, d)
    expect(d.write).toHaveBeenCalledWith('pty-1', 'pnpm dev\r')
    expect(d.nameTab).toHaveBeenCalledWith('unified-1', 'Dev')
    expect(d.rememberRun).toHaveBeenCalledWith('group-1', 'h1')
    expect(d.runInNewTab).not.toHaveBeenCalled()
  })

  it('runs in an idle terminal tab that is not shown, and rings its bell without switching to it', async () => {
    const d = deps(['live', 'unverifiable', 'exited'])
    await runQuickCommand(args, d)
    expect(d.probe).toHaveBeenCalledWith(['pty-1', 'pty-4', 'pty-3'])
    expect(d.write).toHaveBeenCalledTimes(1)
    expect(d.write).toHaveBeenCalledWith('pty-3', 'pnpm dev\r')
    expect(d.nameTab).toHaveBeenCalledWith('unified-3', 'Dev')
    expect(d.ringBell).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      tabId: 'term-3',
      paneKey: 'term-3:leaf'
    })
    expect(d.rememberRun).toHaveBeenCalledWith('group-2', 'h1')
    expect(d.track).toHaveBeenCalledWith('wt-1', 'term-3', 'Dev')
  })

  it('watches a command it opened a new terminal for', async () => {
    const d = deps(['live', 'live', 'live'])
    await runQuickCommand(args, d)
    expect(d.track).toHaveBeenCalledWith('wt-1', 'term-9', 'Dev')
  })

  it('reruns in the terminal it ran in before, when that one is idle', async () => {
    const d = deps(
      ['exited', 'exited', 'exited'],
      [target(1, 'group-1'), target(4, 'group-1'), target(3, 'group-2', 'Dev')]
    )
    await runQuickCommand(args, d)
    expect(d.write).toHaveBeenCalledWith('pty-3', 'pnpm dev\r')
  })

  it('stops the command instead of starting it twice while it still runs', async () => {
    const d = deps(
      ['exited', 'exited', 'live'],
      [target(1, 'group-1'), target(4, 'group-1'), target(3, 'group-2', 'Dev')],
      { 'term-3': 'Dev' }
    )
    await runQuickCommand(args, d)
    expect(d.write).toHaveBeenCalledTimes(1)
    expect(d.write).toHaveBeenCalledWith('pty-3', '\x03')
    expect(d.runInNewTab).not.toHaveBeenCalled()
  })

  it('leaves alone what runs in its old terminal once the command itself is done', async () => {
    const d = deps(
      ['exited', 'exited', 'live'],
      [target(1, 'group-1'), target(4, 'group-1'), target(3, 'group-2', 'Dev')],
      { 'term-3': 'Other' }
    )
    await runQuickCommand(args, d)
    expect(d.write).not.toHaveBeenCalledWith('pty-3', '\x03')
    expect(d.write).toHaveBeenCalledWith('pty-1', 'pnpm dev\r')
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
