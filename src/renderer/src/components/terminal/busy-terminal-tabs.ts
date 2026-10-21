import { useAppStore } from '@/store'
import type { Tab } from '../../../../shared/tab-types'
import { collectTabPtyIds, RUNNING_CLOSE_PROBE_TIMEOUT_MS } from './running-terminal-close-guard'
import { probePtyRunningWork } from './pty-running-work-probe'

/** Fork: the terminal tabs a bulk close should leave open because a process is still running. */
export async function findBusyTerminalTabIds(tabs: readonly Tab[]): Promise<Set<string>> {
  const state = useAppStore.getState()
  const tabIdByPtyId = new Map<string, string>()
  for (const tab of tabs) {
    if (tab.contentType !== 'terminal') {
      continue
    }
    for (const ptyId of collectTabPtyIds(state, tab.entityId)) {
      tabIdByPtyId.set(ptyId, tab.id)
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
    // Why: an unanswered probe is not evidence of an idle shell, so the tab stays open.
    if (probe.verdict === 'live' || probe.timedOut) {
      busy.add(tabIdByPtyId.get(probe.ptyId) ?? '')
    }
  }
  busy.delete('')
  return busy
}
