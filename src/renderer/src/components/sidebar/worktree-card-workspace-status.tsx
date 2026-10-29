import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { WorkspaceStatusDefinition, Worktree } from '../../../../shared/worktree/types'
import { getWorkspaceStatus, getWorkspaceStatusVisualMeta } from './workspace-status'

export function WorktreeCardWorkspaceStatus({
  enabled,
  worktree,
  workspaceStatuses,
  className
}: {
  enabled: boolean
  worktree: Pick<Worktree, 'workspaceStatus'>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
  className?: string
}): React.JSX.Element | null {
  if (!enabled) {
    return null
  }
  const statusId = getWorkspaceStatus(worktree, workspaceStatuses)
  const definition = workspaceStatuses.find((status) => status.id === statusId)
  const { icon: Icon, tone } = getWorkspaceStatusVisualMeta(definition ?? statusId)
  const label = definition?.label ?? statusId
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex min-w-0 shrink items-center gap-0.5 text-[10px] text-muted-foreground',
            className
          )}
          data-worktree-card-workspace-status={statusId}
        >
          <Icon className={cn('size-3 shrink-0', tone)} />
          <span className="truncate">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {translate('auto.components.sidebar.WorktreeCard.workspaceStatus', 'Status: {{status}}', {
          status: label
        })}
      </TooltipContent>
    </Tooltip>
  )
}
