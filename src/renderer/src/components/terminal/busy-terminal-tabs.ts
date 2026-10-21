import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { collectTabPtyIds, RUNNING_CLOSE_PROBE_TIMEOUT_MS } from './running-terminal-close-guard'
import { probePtyRunningWork } from './pty-running-work-probe'
import { isTerminalLeafId, makePaneKey } from '../../../../shared/stable-pane-id'

function isAgentDone(
  state: ReturnType<typeof useAppStore.getState>,
  tabId: string,
  leafId: string
): boolean {
  if (!isTerminalLeafId(leafId) || !tabId || tabId.includes(':')) {
    return false
  }
  return state.agentStatusByPaneKey?.[makePaneKey(tabId, leafId)]?.state === 'done'
}

/** Fork: the terminal tabs a bulk close should leave open because a process is still running. */
export async function findBusyTerminalTabIds(tabs: readonly Tab[]): Promise<Set<string>> {
  const state = useAppStore.getState()
  const tabIdByPtyId = new Map<string, string>()
  const doneAgentPtyIds = new Set<string>()
  for (const tab of tabs) {
    if (tab.contentType !== 'terminal') {
      continue
    }
    for (const ptyId of collectTabPtyIds(state, tab.entityId)) {
      tabIdByPtyId.set(ptyId, tab.id)
    }
    const ptyIdsByLeafId = state.terminalLayoutsByTabId?.[tab.entityId]?.ptyIdsByLeafId ?? {}
    for (const [leafId, ptyId] of Object.entries(ptyIdsByLeafId)) {
      if (ptyId && isAgentDone(state, tab.entityId, leafId)) {
        doneAgentPtyIds.add(ptyId)
      }
    }
  }
  const busy = new Set<string>()
  if (tabIdByPtyId.size === 0) {
    return busy
  }
  const probes = await probePtyRunningWork([...tabIdByPtyId.keys()], {
    timeoutMs: RUNNING_CLOSE_PROBE_TIMEOUT_MS
  })
  for (const probe of probes) {
    // Why: an agent that reported done is idle though its process lives on; an unanswered
    // probe is not evidence of an idle shell, so that tab stays open.
    if (doneAgentPtyIds.has(probe.ptyId)) {
      continue
    }
    if (probe.verdict === 'live' || probe.timedOut) {
      busy.add(tabIdByPtyId.get(probe.ptyId) ?? '')
    }
  }
  busy.delete('')
  return busy
}
