import { useAppStore } from '@/store'
import { getWorkspacePortsByWorktreeId } from '@/lib/workspace-port-groups'
import { cachedWorktreePortLabels, pickFrontendPortLabel } from '@/lib/workspace-port-labels'
import { shouldOpenWorkspacePortInOrcaBrowser } from '@/lib/workspace-port-actions'

/** Opens a workspace's frontend dev server the way the top bar button does. */
export function openWorkspaceFrontendUrl(worktreeId: string, url: string): void {
  const state = useAppStore.getState()
  if (shouldOpenWorkspacePortInOrcaBrowser(state.settings)) {
    state.createBrowserTab(worktreeId, url)
  } else {
    void window.api.shell.openUrl(url)
  }
}

/** Fork: the frontend button's target for the active workspace, opened; false when none runs. */
export function openActiveWorkspaceFrontend(): boolean {
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  if (!worktreeId) {
    return false
  }
  const ports = getWorkspacePortsByWorktreeId(state.workspacePortScan?.result).get(worktreeId) ?? []
  const frontend = pickFrontendPortLabel(
    cachedWorktreePortLabels(worktreeId),
    ports.map((port) => port.port)
  )
  if (!frontend) {
    return false
  }
  openWorkspaceFrontendUrl(worktreeId, frontend.url)
  return true
}
