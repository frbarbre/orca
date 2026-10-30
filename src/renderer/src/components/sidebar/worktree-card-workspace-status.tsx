import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { WorkspaceStatusDefinition, Worktree } from '../../../../shared/worktree/types'
import type { LinearIssue } from '../../../../shared/linear/issue-types'
import { getWorkspaceStatus, getWorkspaceStatusVisualMeta } from './workspace-status'

const CHIP_CLASS =
  'inline-flex h-4 min-w-0 max-w-full items-center gap-0.5 rounded-[4px] border border-worktree-sidebar-border bg-worktree-sidebar-accent/55 px-0.5'

const CHIP_LABEL_CLASS = 'min-w-0 truncate text-3xs leading-none text-muted-foreground'

function WorkspaceStatusChip({
  worktree,
  workspaceStatuses
}: {
  worktree: Pick<Worktree, 'workspaceStatus'>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
}): React.JSX.Element {
  const statusId = getWorkspaceStatus(worktree, workspaceStatuses)
  const definition = workspaceStatuses.find((status) => status.id === statusId)
  const { icon: Icon, tone } = getWorkspaceStatusVisualMeta(definition ?? statusId)
  const label = definition?.label ?? statusId
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={CHIP_CLASS} data-worktree-card-workspace-status={statusId}>
          <Icon className={cn('size-3 shrink-0', tone)} />
          <span className={CHIP_LABEL_CLASS}>{label}</span>
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

export function WorktreeCardWorkspaceStatus({
  enabled,
  worktree,
  workspaceStatuses,
  labels = [],
  className
}: {
  enabled: boolean
  worktree: Pick<Worktree, 'workspaceStatus'>
  workspaceStatuses: readonly WorkspaceStatusDefinition[]
  labels?: NonNullable<LinearIssue['labelDetails']>
  className?: string
}): React.JSX.Element | null {
  if (!enabled && labels.length === 0) {
    return null
  }
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {enabled ? (
        <WorkspaceStatusChip worktree={worktree} workspaceStatuses={workspaceStatuses} />
      ) : null}
      {labels.map((label) => (
        <span key={label.id} className={CHIP_CLASS} data-worktree-card-linear-label={label.id}>
          <span
            className="mx-0.5 size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color }}
            data-linear-label-color=""
          />
          <span className={CHIP_LABEL_CLASS}>{label.name}</span>
        </span>
      ))}
    </div>
  )
}
