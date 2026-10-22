import React from 'react'
import { MonitorPlay } from 'lucide-react'
import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { getWorkspacePortsByWorktreeId } from '@/lib/workspace-port-groups'
import { pickFrontendPortLabel } from '@/lib/workspace-port-labels'
import { shouldOpenWorkspacePortInOrcaBrowser } from '@/lib/workspace-port-actions'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import { useWorkspacePortLabels } from '../sidebar/worktree-card-port-labels'
import { translate } from '@/i18n/i18n'

const NO_PORTS: WorkspacePort[] = []

// Fork: the active workspace's frontend dev server a click away, while it is running.
export function FrontendDevServerButton(): React.JSX.Element | null {
  const worktreeId = useAppStore((s) => s.activeWorktreeId)
  const ports = useAppStore((s) =>
    worktreeId
      ? (getWorkspacePortsByWorktreeId(s.workspacePortScan?.result).get(worktreeId) ?? NO_PORTS)
      : NO_PORTS
  )
  const openInApp = useAppStore((s) => shouldOpenWorkspacePortInOrcaBrowser(s.settings))
  const createBrowserTab = useAppStore((s) => s.createBrowserTab)
  const labels = useWorkspacePortLabels(ports)
  const frontend = pickFrontendPortLabel(
    labels,
    ports.map((port) => port.port)
  )
  if (!worktreeId || !frontend) {
    return null
  }
  const label = translate('auto.components.sidebar.WorktreeCardPorts.openNamed', 'Open {{label}}', {
    label: frontend.label
  })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={() =>
            openInApp
              ? createBrowserTab(worktreeId, frontend.url)
              : void window.api.shell.openUrl(frontend.url)
          }
        >
          <MonitorPlay className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
