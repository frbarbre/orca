import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useRepoAssignees } from '@/hooks/useIssueMetadata'
import { GitHubUserAvatar } from './github-user-avatar'
import { clampListLeft } from './autocomplete-list-position'
import type { MentionOption } from '@/components/pull-request-page/page-types'
import { translate } from '@/i18n/i18n'

// Why the active workspace: every comment box this feeds belongs to the pull request of the workspace on screen.
export function useActiveRepoMentionOptions(wanted: boolean): MentionOption[] {
  const repo = useAppStore((state) => {
    const worktree = state.activeWorktreeId
      ? state.getKnownWorktreeById(state.activeWorktreeId)
      : undefined
    return worktree ? state.repos.find((entry) => entry.id === worktree.repoId) : undefined
  })
  // Why only once wanted: a comment box mounts per thread, and most are never used to mention anyone.
  const assignees = useRepoAssignees(
    wanted ? (repo?.path ?? null) : null,
    wanted ? (repo?.id ?? null) : null
  )
  return useMemo(
    () =>
      assignees.data.map((user) => ({
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        source: translate('auto.components.github.mentions.member', 'Member')
      })),
    [assignees.data]
  )
}

const LIST_MAX_HEIGHT_PX = 256

export function GitHubMentionList({
  options,
  activeIndex,
  anchor,
  onPick
}: {
  options: readonly MentionOption[]
  activeIndex: number
  anchor: { left: number; top: number; bottom: number }
  onPick: (option: MentionOption) => void
}): React.JSX.Element {
  const placeAbove = anchor.top > LIST_MAX_HEIGHT_PX + 12
  // Why a portal: comment boxes sit inside rounded, overflow-hidden frames and Monaco view zones, which clip anything drawn outside them.
  return createPortal(
    <div
      role="listbox"
      style={{
        position: 'fixed',
        left: clampListLeft(anchor.left, 260),
        width: 260,
        maxHeight: LIST_MAX_HEIGHT_PX,
        ...(placeAbove
          ? { bottom: window.innerHeight - anchor.top + 4 }
          : { top: anchor.bottom + 4 })
      }}
      className="z-[1000] overflow-y-auto rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg scrollbar-sleek"
    >
      {options.map((option, index) => (
        <button
          key={option.login}
          role="option"
          aria-selected={index === activeIndex}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(option)
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px]',
            index === activeIndex && 'bg-accent text-accent-foreground'
          )}
        >
          <GitHubUserAvatar
            login={option.login}
            name={option.name}
            avatarUrl={option.avatarUrl}
            className="size-5"
          />
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="shrink-0 font-medium">@{option.login}</span>
            {option.name ? (
              <span className="truncate text-muted-foreground">{option.name}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>,
    document.body
  )
}
