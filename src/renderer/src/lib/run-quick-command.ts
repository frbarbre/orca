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

type TerminalTarget = { tabId: string; ptyId: string; groupId: string }

type TargetState = Pick<
  AppState,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'terminalLayoutsByTabId'
>

/**
 * The worktree's terminal processes in the order a quick command should try them: the terminal
 * the group is showing, then the group's other terminal tabs, then the worktree's other terminals.
 */
export function findTerminalCandidates(
  state: TargetState,
  worktreeId: string,
  groupId: string | null | undefined
): TerminalTarget[] {
  const activeId = groupId
    ? state.groupsByWorktree[worktreeId]?.find((group) => group.id === groupId)?.activeTabId
    : null
  const rank = (tab: { id: string; groupId: string }): number =>
    tab.id === activeId ? 0 : tab.groupId === groupId ? 1 : 2
  const targets: (TerminalTarget & { rank: number })[] = []
  for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) {
    if (tab.contentType !== 'terminal') {
      continue
    }
    const layout = state.terminalLayoutsByTabId[tab.entityId]
    const ptyId = layout?.activeLeafId ? layout.ptyIdsByLeafId?.[layout.activeLeafId] : undefined
    if (ptyId) {
      targets.push({ tabId: tab.id, ptyId, groupId: tab.groupId, rank: rank(tab) })
    }
  }
  return targets.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...target }) => target)
}

export type RunQuickCommandDeps = {
  findTargets: (worktreeId: string, groupId: string | null | undefined) => TerminalTarget[]
  probe: (ptyIds: readonly string[]) => Promise<PtyRunningWorkVerdict[]>
  write: (ptyId: string, data: string) => boolean
  showTab: (tabId: string) => void
  rememberRun: (groupId: string, historyId: string) => void
  runInNewTab: (args: RunQuickCommandInNewTabArgs) => void
}

const defaultDeps: RunQuickCommandDeps = {
  findTargets: (worktreeId, groupId) =>
    findTerminalCandidates(useAppStore.getState(), worktreeId, groupId),
  probe: async (ptyIds) => {
    const probes = await probePtyRunningWork(ptyIds, { timeoutMs: IDLE_PROBE_TIMEOUT_MS })
    return ptyIds.map(
      (ptyId) => probes.find((probe) => probe.ptyId === ptyId)?.verdict ?? 'unverifiable'
    )
  },
  write: (ptyId, data) => sendRuntimePtyInput(ptyId, data, 'driving'),
  showTab: (tabId) => {
    const store = useAppStore.getState()
    store.activateTab(tabId)
    const worktreeId = store.activeWorktreeId
    if (worktreeId) {
      store.setActiveTabType('terminal', worktreeId)
    }
  },
  rememberRun: (groupId, historyId) =>
    useAppStore.getState().setRecentQuickCommandForGroup(groupId, historyId),
  runInNewTab: (args) => void runQuickCommandInNewTab(args)
}

/**
 * Fork: runs a terminal quick command in an idle terminal of the worktree, shown or not, so an
 * idle shell is reused instead of a new tab piling up; otherwise opens one as before.
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
  const targets = deps.findTargets(worktreeId, groupId)
  const verdicts = targets.length > 0 ? await deps.probe(targets.map((target) => target.ptyId)) : []
  const text = `${flattenTerminalQuickCommand(command).command}\r`
  const target = targets.find(
    (candidate, index) => verdicts[index] === 'exited' && deps.write(candidate.ptyId, text)
  )
  if (target) {
    deps.showTab(target.tabId)
    deps.rememberRun(target.groupId, historyId)
    return
  }
  deps.runInNewTab(args)
}
