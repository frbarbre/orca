import React from 'react'
import { TruncatedSidebarLabel } from './truncated-sidebar-label'

export function WorktreeCardLinearTitle({
  enabled,
  title,
  tooltipEnabled
}: {
  enabled: boolean
  title: string | null | undefined
  tooltipEnabled: boolean
}): React.JSX.Element | null {
  const text = enabled ? title?.trim() : undefined
  if (!text) {
    return null
  }
  return (
    <div className="flex min-w-0" data-worktree-card-linear-title="">
      <TruncatedSidebarLabel
        text={text}
        className="text-[11px] text-foreground/80 leading-tight"
        tooltipEnabled={tooltipEnabled}
      />
    </div>
  )
}
