import React, { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useAppStore } from '@/store'
import { useWorktreePortLabels, type PortLabel } from '@/lib/workspace-port-labels'
import type { WorkspacePort } from '../../../../shared/workspace-ports'
import { translate } from '@/i18n/i18n'
import { useOpenWorkspacePort } from './use-open-workspace-port'

/** Fork: the names the workspace's repo gives its live ports, from the repo's URLs command. */
export function useWorkspacePortLabels(ports: readonly WorkspacePort[]): PortLabel[] {
  const owner = ports.find(
    (port): port is Extract<WorkspacePort, { kind: 'workspace' }> => port.kind === 'workspace'
  )?.owner
  const command = useAppStore((s) =>
    owner ? s.repos?.find((repo) => repo.id === owner.repoId)?.portLabelsCommand : undefined
  )
  const portKey = ports.map((port) => port.port).join(',')
  const livePorts = useMemo(() => (portKey ? portKey.split(',').map(Number) : []), [portKey])
  return useWorktreePortLabels(owner?.worktreeId ?? null, owner?.path ?? null, command, livePorts)
}

export function OpenFrontendButton({
  port,
  label
}: {
  port: WorkspacePort
  label: string
}): React.JSX.Element {
  const open = useOpenWorkspacePort(port)
  return (
    <button
      type="button"
      className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-foreground hover:bg-accent"
      title={translate('auto.components.sidebar.WorktreeCardPorts.openNamed', 'Open {{label}}', {
        label
      })}
      onClick={open}
    >
      <ExternalLink className="size-3" />
      {label}
    </button>
  )
}
