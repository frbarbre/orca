import { useAppStore } from '@/store'
import { resolveSplitCwd, type PaneCwdMap } from './resolve-split-cwd'

/** Fork: Warp-style split — a new terminal tab in a new group beside this tab's, in this pane's folder. */
export async function openTerminalGroup(args: {
  worktreeId: string
  tabId: string
  direction: 'right' | 'down'
  sourcePaneId: number
  sourcePtyId: string | null
  paneCwdMap: PaneCwdMap
  fallbackCwd: string
}): Promise<void> {
  const sourceGroupId = useAppStore
    .getState()
    .unifiedTabsByWorktree[args.worktreeId]?.find(
      (tab) => tab.contentType === 'terminal' && tab.entityId === args.tabId
    )?.groupId
  if (!sourceGroupId) {
    return
  }
  const cwd = await resolveSplitCwd({
    paneCwdMap: args.paneCwdMap,
    sourcePaneId: args.sourcePaneId,
    sourcePtyId: args.sourcePtyId,
    fallbackCwd: args.fallbackCwd
  })
  useAppStore.getState().createTab(args.worktreeId, undefined, undefined, {
    split: { sourceGroupId, splitDirection: args.direction },
    activate: true,
    ...(cwd ? { startupCwd: cwd } : {})
  })
}
