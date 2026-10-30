import { useMemo, useState } from 'react'
import { ChevronDown, GitBranch, GitPullRequest } from 'lucide-react'
import type {
  GitHubPRStack,
  GitHubPRStackEntry
} from '../../../../shared/github/pull-request-types'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import {
  getGitHubPRStackEntryStatus,
  type GitHubPRStackEntryTone
} from './github-pr-stack-entry-status'

export type GitHubPRStackMapNavigationModifiers = Pick<
  React.MouseEvent<HTMLButtonElement>,
  'metaKey' | 'ctrlKey' | 'shiftKey'
>

const STACK_ENTRY_TONE_CLASS: Record<GitHubPRStackEntryTone, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400',
  blocked: 'border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400',
  merged: 'border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400',
  neutral: 'border-border bg-muted text-muted-foreground'
}

function StackEntryStatusBadge({ entry }: { entry: GitHubPRStackEntry }): React.JSX.Element {
  const { label, tone } = getGitHubPRStackEntryStatus(entry)
  return (
    <span
      data-stack-pr-status={tone}
      className={cn(
        'shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium leading-4',
        STACK_ENTRY_TONE_CLASS[tone]
      )}
    >
      {label}
    </span>
  )
}

export function GitHubPRStackMap({
  stack,
  currentPRNumber,
  onOpenPullRequest
}: {
  stack: GitHubPRStack
  currentPRNumber: number
  onOpenPullRequest: (
    entry: GitHubPRStackEntry,
    modifiers: GitHubPRStackMapNavigationModifiers
  ) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const entries = useMemo(
    () => [...(stack.entries ?? [])].sort((a, b) => b.position - a.position),
    [stack.entries]
  )

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-md border border-border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={
            open
              ? translate(
                  'auto.components.right.sidebar.GitHubPRStackMap.7737bd66be',
                  'Collapse stack #{{value0}}',
                  { value0: stack.number }
                )
              : translate(
                  'auto.components.right.sidebar.GitHubPRStackMap.0c1645ebd0',
                  'Expand stack #{{value0}}',
                  { value0: stack.number }
                )
          }
        >
          <GitPullRequest className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {translate(
              'auto.components.right.sidebar.GitHubPRStackMap.e3ee2daa32',
              'Stack #{{value0}}',
              { value0: stack.number }
            )}
          </span>
          <span className="text-muted-foreground">
            {translate(
              'auto.components.right.sidebar.GitHubPRStackMap.cb440931b7',
              '{{value0}} of {{value1}} · {{value2}}',
              { value0: stack.position, value1: stack.size, value2: stack.baseRefName }
            )}
          </span>
          <ChevronDown
            className={cn(
              'ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border">
        {entries.length > 0 ? (
          <div className="py-1">
            {entries.map((entry) => {
              const current = entry.number === currentPRNumber
              return (
                <button
                  key={entry.number}
                  type="button"
                  data-stack-pr-number={entry.number}
                  data-current={current ? 'true' : undefined}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    current && 'bg-accent'
                  )}
                  onClick={(event) =>
                    onOpenPullRequest(entry, {
                      metaKey: event.metaKey,
                      ctrlKey: event.ctrlKey,
                      shiftKey: event.shiftKey
                    })
                  }
                >
                  <span className="w-8 shrink-0 font-medium text-foreground">#{entry.number}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{entry.title}</span>
                  <StackEntryStatusBadge entry={entry} />
                </button>
              )
            })}
            <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate">{stack.baseRefName}</span>
            </div>
          </div>
        ) : (
          <div className="px-2 py-2 text-[11px] text-muted-foreground">
            {translate(
              'auto.components.right.sidebar.GitHubPRStackMap.525259fa17',
              'Stack details are temporarily unavailable.'
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
