import React from 'react'
import { Layers } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { GitHubPRStack } from '../../../../shared/github/pull-request-types'

export function WorktreeCardStackPosition({
  enabled,
  stack,
  className
}: {
  enabled: boolean
  stack: GitHubPRStack | undefined
  className?: string
}): React.JSX.Element | null {
  if (!enabled || !stack) {
    return null
  }
  const description = translate(
    'auto.components.sidebar.WorktreeCard.stackPosition',
    'Stack #{{stack}}, {{position}} of {{size}}',
    { stack: stack.number, position: stack.position, size: stack.size }
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground',
            className
          )}
          aria-label={description}
          data-worktree-card-stack-position=""
        >
          <Layers className="size-3" />
          {stack.position}/{stack.size}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {description}
      </TooltipContent>
    </Tooltip>
  )
}
