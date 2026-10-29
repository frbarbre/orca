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
            'inline-flex h-4 min-w-0 max-w-full items-center gap-0.5 rounded-[4px] border border-worktree-sidebar-border bg-worktree-sidebar-accent/55 px-0.5',
            className
          )}
          data-worktree-card-workspace-status={statusId}
        >
          <Icon className={cn('size-3 shrink-0', tone)} />
          <span className="min-w-0 truncate text-3xs leading-none text-muted-foreground">
            {label}
          </span>
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
