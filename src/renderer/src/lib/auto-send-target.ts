import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { Tab, TabGroup, TabGroupLayoutNode } from '../../../shared/tab-types'
import { collectLayoutGroupIds } from '@/runtime/web-session-tabs-sync/tab-group-layout-tree'
import type { NotesSendAgentTarget } from './notes-send-agent-targets'

export type AutoSendTargetState = {
  agentStatusByPaneKey: Record<string, AgentStatusEntry | undefined>
  unifiedTabsByWorktree: Record<string, Tab[] | undefined>
  groupsByWorktree: Record<string, TabGroup[] | undefined>
  layoutByWorktree: Record<string, TabGroupLayoutNode | undefined>
}

function unifiedTabFor(target: NotesSendAgentTarget, tabs: readonly Tab[]): Tab | undefined {
  // A terminal target names its terminal tab (the unified tab's entity); a chat names its own tab.
  return target.messageTarget.kind === 'terminal'
    ? tabs.find((tab) => tab.contentType === 'terminal' && tab.entityId === target.tabId)
    : tabs.find((tab) => tab.id === target.tabId)
}

function lastActivityAt(
  target: NotesSendAgentTarget,
  state: AutoSendTargetState,
  tab: Tab | undefined
): number {
  return state.agentStatusByPaneKey[target.paneKey]?.updatedAt ?? tab?.lastFocusedAt ?? 0
}

/**
 * The session notes go to without choosing: one open in a visible window's active tab wins,
 * the most recently active among several; with none open, the most recently active of all.
 */
export function pickAutoSendTarget(
  targets: readonly NotesSendAgentTarget[],
  state: AutoSendTargetState,
  worktreeId: string
): NotesSendAgentTarget | null {
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const layout = state.layoutByWorktree[worktreeId]
  const visibleGroupIds = layout ? collectLayoutGroupIds(layout) : null
  const openTabIds = new Set(
    (state.groupsByWorktree[worktreeId] ?? [])
      .filter((group) => visibleGroupIds === null || visibleGroupIds.has(group.id))
      .flatMap((group) => (group.activeTabId ? [group.activeTabId] : []))
  )

  let best: { target: NotesSendAgentTarget; isOpen: boolean; activity: number } | null = null
  for (const target of targets) {
    if (target.status !== 'eligible') {
      continue
    }
    const tab = unifiedTabFor(target, tabs)
    const candidate = {
      target,
      isOpen: tab !== undefined && openTabIds.has(tab.id),
      activity: lastActivityAt(target, state, tab)
    }
    const beats =
      best === null ||
      (candidate.isOpen && !best.isOpen) ||
      (candidate.isOpen === best.isOpen && candidate.activity > best.activity)
    if (beats) {
      best = candidate
    }
  }
  return best?.target ?? null
}
