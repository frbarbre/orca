import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useWorktreeRuntimeTarget } from '@/runtime/use-worktree-runtime-target'
import {
  openWorkspacePortInBrowser,
  resolvePortOpenInOrcaBrowser
} from '@/lib/workspace-port-actions'
import { useLocalhostLabelRouteForPort } from '@/lib/workspace-port-localhost-label-selector'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import { translate } from '@/i18n/i18n'

/** Opens a port in a browser on its owner host, the same way from a row and from a quick button. */
export function useOpenWorkspacePort(
  port: WorkspacePort
): (event: React.MouseEvent<HTMLButtonElement>) => void {
  const settings = useAppStore((s) => s.settings)
  const localhostLabelRoute = useLocalhostLabelRouteForPort(port)
  const createBrowserTab = useAppStore((s) => s.createBrowserTab)
  const setRemoteBrowserPageHandle = useAppStore((s) => s.setRemoteBrowserPageHandle)
  const recordFeatureInteraction = useAppStore((s) => s.recordFeatureInteraction)
  const runtimeTarget = useWorktreeRuntimeTarget(
    port.kind === 'workspace' ? port.owner.worktreeId : null
  )

  return useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      recordFeatureInteraction('ports')
      const openInOrcaBrowser = resolvePortOpenInOrcaBrowser({
        settings,
        // Why: keyboard activations have detail=0; only pointer clicks carry
        // the modifier intent for the system-browser escape hatch.
        event: event.detail > 0 ? event : null,
        isMac: navigator.userAgent.includes('Mac')
      })
      void openWorkspacePortInBrowser({
        port,
        runtimeTarget,
        createBrowserTab,
        setRemoteBrowserPageHandle,
        openInOrcaBrowser,
        localhostLabelRoute
      }).then((result) => {
        if (!result.ok) {
          toast.error(
            translate(
              'auto.components.sidebar.WorktreeCardPorts.d1113f4660',
              'Failed to open browser'
            ),
            { description: result.reason }
          )
        }
      })
    },
    [
      createBrowserTab,
      port,
      localhostLabelRoute,
      recordFeatureInteraction,
      runtimeTarget,
      setRemoteBrowserPageHandle,
      settings
    ]
  )
}
