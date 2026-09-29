import React from 'react'
import { GitHubUserAvatar } from '@/components/github/github-user-avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { usePullRequestAuthor } from '../workspace-status-rules/pr-author-store'

export function WorktreeCardPrAuthor({
  worktreeId,
  enabled,
  className
}: {
  worktreeId: string
  enabled: boolean
  className?: string
}): React.JSX.Element | null {
  const login = usePullRequestAuthor(worktreeId)
  if (!enabled || !login) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex shrink-0', className)} data-worktree-card-pr-author="">
          <GitHubUserAvatar login={login} className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {translate('auto.components.sidebar.WorktreeCard.prAuthor', 'Pull request by {{login}}', {
          login
        })}
      </TooltipContent>
    </Tooltip>
  )
}
