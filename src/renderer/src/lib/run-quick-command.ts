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
import { withTabQuickCommandLabel } from '@/store/slices/tabs/tab-quick-command-label'
import type { TerminalPaneAttentionTarget } from '@/store/slices/workspace-attention/workspace-attention-contract'
import {
  quickCommandRunningIn,
  trackQuickCommandRun,
  type QuickCommandRunProbe
} from './quick-command-runs'
import {
  runQuickCommandInNewTab,
  type RunQuickCommandInNewTabArgs
} from './run-quick-command-in-new-tab'

const IDLE_PROBE_TIMEOUT_MS = 1500
const INTERRUPT = '\x03'

type TerminalTarget = {
  tabId: string
  terminalId: string
  paneKey: string
  ptyId: string
  groupId: string
  quickCommandLabel: string | null
}

type TargetState = Pick<
  AppState,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'tabsByWorktree' | 'terminalLayoutsByTabId'
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
  const rows = state.tabsByWorktree[worktreeId] ?? []
  const targets: (TerminalTarget & { rank: number })[] = []
  for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) {
    if (tab.contentType !== 'terminal') {
      continue
    }
    const layout = state.terminalLayoutsByTabId[tab.entityId]
    const leafId = layout?.activeLeafId
    const ptyId = leafId ? layout.ptyIdsByLeafId?.[leafId] : undefined
    if (!leafId || !ptyId) {
      continue
    }
    const label =
      tab.quickCommandLabel?.trim() ||
      rows.find((row) => row.id === tab.entityId)?.quickCommandLabel?.trim() ||
      null
    targets.push({
      tabId: tab.id,
      terminalId: tab.entityId,
      paneKey: `${tab.entityId}:${leafId}`,
      ptyId,
      groupId: tab.groupId,
      quickCommandLabel: label,
      rank: rank(tab)
    })
  }
  return targets.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...target }) => target)
}

export type RunQuickCommandDeps = {
  findTargets: (worktreeId: string, groupId: string | null | undefined) => TerminalTarget[]
  probe: (ptyIds: readonly string[]) => Promise<PtyRunningWorkVerdict[]>
  write: (ptyId: string, data: string) => boolean
  nameTab: (tabId: string, label: string) => void
  ringBell: (target: TerminalPaneAttentionTarget) => void
  rememberRun: (groupId: string, historyId: string) => void
  runningIn: (terminalId: string) => string | null
  track: (worktreeId: string, terminalId: string, label: string) => void
  runInNewTab: (args: RunQuickCommandInNewTabArgs) => string | null
}

function probeTerminal(worktreeId: string, terminalId: string): QuickCommandRunProbe {
  return async () => {
    const state = useAppStore.getState()
    const exists = (state.unifiedTabsByWorktree[worktreeId] ?? []).some(
      (tab) => tab.entityId === terminalId
    )
    if (!exists) {
      return 'gone'
    }
    const target = findTerminalCandidates(state, worktreeId, null).find(
      (candidate) => candidate.terminalId === terminalId
    )
    if (!target) {
      return 'unverifiable'
    }
    const [probe] = await probePtyRunningWork([target.ptyId], { timeoutMs: IDLE_PROBE_TIMEOUT_MS })
    return probe?.verdict ?? 'unverifiable'
  }
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
  nameTab: (tabId, label) =>
    useAppStore.setState((state) => withTabQuickCommandLabel(state, tabId, label)),
  ringBell: (target) => useAppStore.getState().markTerminalBell(target),
  rememberRun: (groupId, historyId) =>
    useAppStore.getState().setRecentQuickCommandForGroup(groupId, historyId),
  runningIn: quickCommandRunningIn,
  track: (worktreeId, terminalId, label) =>
    trackQuickCommandRun(terminalId, label, probeTerminal(worktreeId, terminalId)),
  runInNewTab: (args) => runQuickCommandInNewTab(args)?.tabId ?? null
}

/**
 * Fork: a terminal quick command toggles. While the process it started still runs, running it
 * again interrupts that terminal. Otherwise it runs in an idle terminal of the worktree, the
 * one it ran in before first, naming the tab after it and ringing the tab's bell when it isn't
 * shown; with none idle it opens a new tab as before.
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
  const label = command.label.trim()
  const targets = deps.findTargets(worktreeId, groupId)
  const verdicts = targets.length > 0 ? await deps.probe(targets.map((target) => target.ptyId)) : []
  const probed = targets.map((target, index) => ({ target, verdict: verdicts[index] }))
  const isOwn = ({ target }: (typeof probed)[number]): boolean =>
    Boolean(label) && target.quickCommandLabel === label
  const running = probed.find(
    (entry) =>
      Boolean(label) &&
      deps.runningIn(entry.target.terminalId) === label &&
      entry.verdict === 'live'
  )
  if (running) {
    deps.write(running.target.ptyId, INTERRUPT)
    return
  }
  const text = `${flattenTerminalQuickCommand(command).command}\r`
  const idle = [...probed.filter(isOwn), ...probed.filter((entry) => !isOwn(entry))].find(
    (entry) => entry.verdict === 'exited' && deps.write(entry.target.ptyId, text)
  )?.target
  if (idle) {
    if (label) {
      deps.nameTab(idle.tabId, label)
      deps.track(worktreeId, idle.terminalId, label)
    }
    deps.ringBell({ worktreeId, tabId: idle.terminalId, paneKey: idle.paneKey })
    deps.rememberRun(idle.groupId, historyId)
    return
  }
  const terminalId = deps.runInNewTab(args)
  if (terminalId && label) {
    deps.track(worktreeId, terminalId, label)
  }
}
