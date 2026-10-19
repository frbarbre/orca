import type { AppState } from '@/store/types'
import { findTabAndWorktree, patchTab } from '../tab-group-state'
import { locateTerminalTab } from '../../terminals/terminal-tab-location'

export function withTabQuickCommandLabel(
  state: Pick<AppState, 'unifiedTabsByWorktree' | 'tabsByWorktree'>,
  tabId: string,
  label: string
): Partial<Pick<AppState, 'unifiedTabsByWorktree' | 'tabsByWorktree'>> {
  const quickCommandLabel = label.trim()
  const found = findTabAndWorktree(state.unifiedTabsByWorktree, tabId)
  if (!quickCommandLabel || !found) {
    return {}
  }
  const tabPatch = patchTab(state.unifiedTabsByWorktree, tabId, { quickCommandLabel }) ?? {}
  const row = locateTerminalTab(state.tabsByWorktree, found.tab.entityId)
  if (!row || row.tab.quickCommandLabel === quickCommandLabel) {
    return tabPatch
  }
  const rows = state.tabsByWorktree[row.worktreeId].slice()
  rows[row.index] = { ...row.tab, quickCommandLabel }
  return { ...tabPatch, tabsByWorktree: { ...state.tabsByWorktree, [row.worktreeId]: rows } }
}
