import { describe, expect, it, vi } from 'vitest'
import {
  findActiveTerminalPty,
  runQuickCommand,
  type RunQuickCommandDeps
} from './run-quick-command'

const state = {
  activeTabIdByGroup: { 'group-1': 'unified-1', 'group-2': 'unified-2' },
  unifiedTabsByWorktree: {
    'wt-1': [
      { id: 'unified-1', entityId: 'term-1', contentType: 'terminal', groupId: 'group-1' },
      { id: 'unified-2', entityId: 'editor-1', contentType: 'editor', groupId: 'group-2' }
    ]
  },
  terminalLayoutsByTabId: {
    'term-1': {
      root: null,
      activeLeafId: 'leaf-1',
      expandedLeafId: null,
      ptyIdsByLeafId: { 'leaf-1': 'pty-1' }
    }
  }
} as never

describe('findActiveTerminalPty', () => {
  it("finds the shown terminal pane's process in the group", () => {
    expect(findActiveTerminalPty(state, 'wt-1', 'group-1')).toEqual({
      tabId: 'unified-1',
      ptyId: 'pty-1'
    })
  })

  it('finds nothing when the group shows something other than a terminal', () => {
    expect(findActiveTerminalPty(state, 'wt-1', 'group-2')).toBeNull()
  })
})

function deps(verdict: 'live' | 'exited' | 'unverifiable'): RunQuickCommandDeps {
  return {
    findTarget: () => ({ tabId: 'unified-1', ptyId: 'pty-1' }),
    probe: vi.fn(async () => verdict),
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
    const d = deps('exited')
    await runQuickCommand(args, d)
    expect(d.write).toHaveBeenCalledWith('pty-1', 'pnpm dev\r')
    expect(d.showTab).toHaveBeenCalledWith('unified-1')
    expect(d.rememberRun).toHaveBeenCalledWith('group-1', 'h1')
    expect(d.runInNewTab).not.toHaveBeenCalled()
  })

  it('opens a new terminal when something runs there, or that cannot be told', async () => {
    for (const verdict of ['live', 'unverifiable'] as const) {
      const d = deps(verdict)
      await runQuickCommand(args, d)
      expect(d.write).not.toHaveBeenCalled()
      expect(d.runInNewTab).toHaveBeenCalledWith(args)
    }
  })

  it('opens a new tab for an agent prompt, as before', async () => {
    const d = deps('exited')
    const agentCommand = {
      ...args,
      command: { ...(command as object), action: 'agent-prompt', agent: 'claude', prompt: 'hi' }
    } as never
    await runQuickCommand(agentCommand, d)
    expect(d.probe).not.toHaveBeenCalled()
    expect(d.runInNewTab).toHaveBeenCalled()
  })
})
