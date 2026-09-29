import React, { useCallback, useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useRepoAssignees } from '@/hooks/useIssueMetadata'
import { filterGitHubMentionOptions } from './github-mention-option-filter'
import { GitHubUserAvatar } from './github-user-avatar'
import { findMentionQuery } from '@/components/pull-request-page/mentions/query'
import type { MentionOption, MentionQuery } from '@/components/pull-request-page/page-types'
import { translate } from '@/i18n/i18n'

// Why the active workspace: every comment box this feeds belongs to the pull request of the workspace on screen.
function useActiveRepoMentionOptions(wanted: boolean): MentionOption[] {
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

export type MentionAutocomplete = {
  sync: (textarea: HTMLTextAreaElement) => void
  close: () => void
  /** True when the key was used to drive the suggestion list, so the caller skips its own handling. */
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  onKeyUp: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  list: React.JSX.Element | null
}

export function useMentionAutocomplete({
  value,
  setValue,
  textareaRef,
  enabled = true,
  options: providedOptions
}: {
  value: string
  setValue: (next: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  enabled?: boolean
  /** Defaults to the members of the active workspace's repository. */
  options?: readonly MentionOption[]
}): MentionAutocomplete {
  const listboxId = useId()
  const [rawQuery, setQuery] = useState<MentionQuery | null>(null)
  const query = enabled ? rawQuery : null
  const [activeIndex, setActiveIndex] = useState(0)
  const repoOptions = useActiveRepoMentionOptions(!providedOptions && query !== null)
  const options = providedOptions ?? repoOptions
  const suggestions = useMemo(
    () => (query ? filterGitHubMentionOptions([...options], query.query) : []),
    [options, query]
  )
  const open = query !== null && suggestions.length > 0

  const sync = useCallback((textarea: HTMLTextAreaElement) => {
    setQuery(findMentionQuery(textarea.value, textarea.selectionStart))
    setActiveIndex(0)
  }, [])
  const close = useCallback(() => setQuery(null), [])

  const insert = useCallback(
    (option: MentionOption) => {
      const textarea = textareaRef.current
      const caret = textarea?.selectionStart ?? value.length
      const current = findMentionQuery(value, caret)
      if (!current) {
        return
      }
      const suffix = value[caret] && /\s/.test(value[caret]) ? '' : ' '
      const inserted = `@${option.login}${suffix}`
      const next = `${value.slice(0, current.atIndex)}${inserted}${value.slice(caret)}`
      const nextCaret = current.atIndex + inserted.length
      setValue(next)
      setQuery(null)
      requestAnimationFrame(() => {
        textarea?.focus()
        textarea?.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [setValue, textareaRef, value]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) {
        return false
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((current) => (current + step + suggestions.length) % suggestions.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insert(suggestions[activeIndex] ?? suggestions[0])
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setQuery(null)
        return true
      }
      return false
    },
    [activeIndex, insert, open, suggestions]
  )

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
        sync(event.currentTarget)
      }
    },
    [sync]
  )

  const list = open ? (
    <div
      id={listboxId}
      role="listbox"
      className="absolute right-0 bottom-[calc(100%+6px)] left-0 z-50 max-h-64 overflow-y-auto rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg scrollbar-sleek"
    >
      {suggestions.map((option, index) => (
        <button
          key={option.login}
          role="option"
          aria-selected={index === activeIndex}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            insert(option)
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
    </div>
  ) : null

  return { sync, close, handleKeyDown, onKeyUp, list }
}
