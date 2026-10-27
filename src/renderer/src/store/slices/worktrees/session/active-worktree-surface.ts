import type { AppState } from '../../../types'
import type { WorkspaceVisibleTabType } from '../../../../../../shared/tab-types'
import type { ActiveSurfaceSourceState } from '../../tabs/tabs-surface'
import { deriveActiveSurfaceForWorktree } from '../../tabs/tabs-surface'

export function resolveActivatedWorktreeSurface(
  s: ActiveSurfaceSourceState &
    Pick<AppState, 'rightSidebarExplorerViewByWorktree' | 'rightSidebarTabByWorktree'>,
  worktreeId: string,
  preferredActiveUnifiedTabId: string | undefined,
  reconciledActiveTabId: string | null
): {
  restoredRightSidebarExplorerView: NonNullable<
    AppState['rightSidebarExplorerViewByWorktree']
  >[string]
  restoredRightSidebarTab: AppState['rightSidebarTab']
  activeFileId: string | null
  activeBrowserTabId: string | null
  activeTabType: WorkspaceVisibleTabType
  activeTabId: string | null
} {
  return {
    restoredRightSidebarExplorerView: s.rightSidebarExplorerViewByWorktree?.[worktreeId] ?? 'files',
    // Fork: a worktree opens on Source Control until it has a tab of its own.
    restoredRightSidebarTab: s.rightSidebarTabByWorktree[worktreeId] ?? 'source-control',
    ...deriveActiveSurfaceForWorktree(s, worktreeId, undefined, {
      legacySelection: 'remembered-type',
      preferredTabId: preferredActiveUnifiedTabId ?? reconciledActiveTabId ?? undefined
    })
  }
}
