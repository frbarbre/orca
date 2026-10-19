import React, { useMemo, useState } from 'react'
import { useWorktreeMentionFiles } from '@/lib/use-worktree-mention-files'
import { readMentionQuery } from '@/components/github/review-mention-extension'
import {
  fileMentionOptions,
  GitHubMentionList
} from '@/components/github/github-mention-autocomplete'

type OpenQuery = {
  query: string
  /** Index of the `@` in the text. */
  from: number
  /** Caret, where the typed query ends. */
  to: number
  anchor: { left: number; top: number; bottom: number }
}

function readOpenQuery(textarea: HTMLTextAreaElement): OpenQuery | null {
  const caret = textarea.selectionStart ?? textarea.value.length
  const query = readMentionQuery(textarea.value.slice(0, caret), 'file')
  if (query === null) {
    return null
  }
  const rect = textarea.getBoundingClientRect()
  return {
    query,
    from: caret - query.length - 1,
    to: caret,
    anchor: { left: rect.left, top: rect.top, bottom: rect.bottom }
  }
}

/**
 * Fork: `@` names a workspace file in a plain text box, as it does in the note composer, so a
 * follow-up to an agent can point it at a file. The list anchors under the box, not the caret.
 */
export function useTextareaFileMentions({
  value,
  onChange,
  textareaRef,
  worktreeId
}: {
  value: string
  onChange: (value: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  worktreeId: string
}): {
  onInput: (textarea: HTMLTextAreaElement) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  list: React.ReactNode
} {
  const [open, setOpen] = useState<OpenQuery | null>(null)
  const [active, setActive] = useState(0)
  const { files } = useWorktreeMentionFiles(open?.query ?? null, worktreeId)
  const options = useMemo(() => fileMentionOptions(files), [files])
  const showing = open !== null && options.length > 0

  const pick = (path: string): void => {
    if (!open) {
      return
    }
    const inserted = `@${path} `
    const next = `${value.slice(0, open.from)}${inserted}${value.slice(open.to)}`
    const caret = open.from + inserted.length
    onChange(next)
    setOpen(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(caret, caret)
    })
  }

  return {
    onInput: (textarea) => {
      setOpen(readOpenQuery(textarea))
      setActive(0)
    },
    onKeyDown: (event) => {
      if (!showing) {
        return false
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((current) => (current + step + options.length) % options.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const choice = options[active] ?? options[0]
        if (choice) {
          pick(choice.login)
        }
        return true
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(null)
        return true
      }
      return false
    },
    list: showing ? (
      <GitHubMentionList
        options={options}
        activeIndex={active}
        anchor={open.anchor}
        onPick={(option) => pick(option.login)}
      />
    ) : null
  }
}
