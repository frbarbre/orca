import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

export type PrDiffStat = { additions: number; deletions: number }

export function WorktreeCardPrDiff({
  enabled,
  diff,
  className
}: {
  enabled: boolean
  diff: PrDiffStat | undefined
  className?: string
}): React.JSX.Element | null {
  if (!enabled || !diff) {
    return null
  }
  const additions = diff.additions.toLocaleString('en-US')
  const deletions = diff.deletions.toLocaleString('en-US')
  const description = translate(
    'auto.components.sidebar.WorktreeCard.prDiff',
    '{{additions}} lines added, {{deletions}} lines removed',
    { additions, deletions }
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums',
            className
          )}
          aria-label={description}
          data-worktree-card-pr-diff=""
        >
          <span className="text-emerald-500">+{additions}</span>
          <span className="text-red-500">−{deletions}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
