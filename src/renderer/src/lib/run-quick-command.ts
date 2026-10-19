import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import {
  flattenTerminalQuickCommand,
  isTerminalAgentQuickCommand
} from '../../../shared/terminal-quick-commands'
import {
  probePtyRunningWork,
  type PtyRunningWorkVerdict
} from '@/components/terminal/pty-running-work-probe'
import { sendRuntimePtyInput } from '@/runtime/runtime-terminal-inspection'
import {
  runQuickCommandInNewTab,
  type RunQuickCommandInNewTabArgs
} from './run-quick-command-in-new-tab'

const IDLE_PROBE_TIMEOUT_MS = 1500

type TerminalTarget = { tabId: string; ptyId: string }

type TargetState = Pick<
  AppState,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'terminalLayoutsByTabId'
>

/** The process behind the terminal pane a group is showing, if it is showing a terminal. */
export function findActiveTerminalPty(
  state: TargetState,
  worktreeId: string,
  groupId: string | null | undefined
): TerminalTarget | null {
  const activeId = groupId
    ? state.groupsByWorktree[worktreeId]?.find((group) => group.id === groupId)?.activeTabId
    : null
  const tab = state.unifiedTabsByWorktree[worktreeId]?.find((entry) => entry.id === activeId)
  if (!tab || tab.contentType !== 'terminal') {
    return null
  }
  const layout = state.terminalLayoutsByTabId[tab.entityId]
  const ptyId = layout?.activeLeafId ? layout.ptyIdsByLeafId?.[layout.activeLeafId] : undefined
  return ptyId ? { tabId: tab.id, ptyId } : null
}

export type RunQuickCommandDeps = {
  findTarget: (worktreeId: string, groupId: string | null | undefined) => TerminalTarget | null
  probe: (ptyId: string) => Promise<PtyRunningWorkVerdict>
  write: (ptyId: string, data: string) => boolean
  showTab: (tabId: string) => void
  rememberRun: (groupId: string, historyId: string) => void
  runInNewTab: (args: RunQuickCommandInNewTabArgs) => void
}

const defaultDeps: RunQuickCommandDeps = {
  findTarget: (worktreeId, groupId) =>
    findActiveTerminalPty(useAppStore.getState(), worktreeId, groupId),
  probe: async (ptyId) =>
    (await probePtyRunningWork([ptyId], { timeoutMs: IDLE_PROBE_TIMEOUT_MS }))[0]?.verdict ??
    'unverifiable',
  write: (ptyId, data) => sendRuntimePtyInput(ptyId, data, 'driving'),
  showTab: (tabId) => useAppStore.getState().activateTab(tabId),
  rememberRun: (groupId, historyId) =>
    useAppStore.getState().setRecentQuickCommandForGroup(groupId, historyId),
  runInNewTab: (args) => void runQuickCommandInNewTab(args)
}

/**
 * Fork: runs a terminal quick command in the terminal the group is showing when nothing runs
 * there, so an idle shell is reused instead of a new tab piling up; otherwise opens one as before.
 * Why only a proven idle shell: typing into a busy or unobservable terminal would feed the
 * command to whatever is running there.
 */
export async function runQuickCommand(
  args: RunQuickCommandInNewTabArgs,
  deps: RunQuickCommandDeps = defaultDeps
): Promise<void> {
  const { command, worktreeId, groupId, historyId = command.id } = args
  if (isTerminalAgentQuickCommand(command) || !command.command.trim()) {
    deps.runInNewTab(args)
    return
  }
  const target = deps.findTarget(worktreeId, groupId)
  if (
    target &&
    (await deps.probe(target.ptyId)) === 'exited' &&
    deps.write(target.ptyId, `${flattenTerminalQuickCommand(command).command}\r`)
  ) {
    deps.showTab(target.tabId)
    if (groupId) {
      deps.rememberRun(groupId, historyId)
    }
    return
  }
  deps.runInNewTab(args)
}
