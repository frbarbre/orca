import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { GitHubMarkdownComposer } from './GitHubMarkdownComposer'
import { filterGitHubMentionOptions } from './github-mention-option-filter'
import { GitHubMentionList, useActiveRepoMentionOptions } from './github-mention-autocomplete'
import { ReviewAssetUpload } from './review-asset-upload-extension'
import { ReviewMention, type MentionQueryState } from './review-mention-extension'

function sameQuery(a: MentionQueryState | null, b: MentionQueryState | null): boolean {
  return a === b || (!!a && !!b && a.query === b.query && a.from === b.from && a.left === b.left)
}

export function ReviewMarkdownComposer({
  value,
  onChange,
  placeholder,
  onUploadingChange,
  onSubmitShortcut,
  onEscape,
  autoFocus,
  disabled,
  mentions = true,
  uploads = true,
  className,
  minHeightClassName = 'min-h-20'
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onUploadingChange?: (uploading: boolean) => void
  onSubmitShortcut?: () => void
  onEscape?: () => void
  autoFocus?: boolean
  disabled?: boolean
  mentions?: boolean
  uploads?: boolean
  className?: string
  minHeightClassName?: string
}): React.JSX.Element {
  const [query, setQuery] = useState<MentionQueryState | null>(null)
  const [active, setActive] = useState(0)
  const editorRef = useRef<Editor | null>(null)
  const options = useActiveRepoMentionOptions(mentions && query !== null)
  const suggestions = useMemo(
    () => (mentions && query ? filterGitHubMentionOptions([...options], query.query) : []),
    [mentions, options, query]
  )
  const open = suggestions.length > 0 && query !== null

  const insert = (login: string): void => {
    const editor = editorRef.current
    if (editor && query) {
      editor.chain().focus().insertContentAt({ from: query.from, to: query.to }, `@${login} `).run()
    }
    setQuery(null)
  }

  // Why refs: the extensions are built once so the editor is never recreated.
  const keyHandler = useRef<(event: KeyboardEvent) => boolean>(() => false)
  const uploadingHandler = useRef(onUploadingChange)
  const uploadsEnabled = useRef(uploads)
  useEffect(() => {
    uploadingHandler.current = onUploadingChange
    uploadsEnabled.current = uploads
    keyHandler.current = (event) => {
      if (!open) {
        if (event.key === 'Escape' && onEscape) {
          event.preventDefault()
          onEscape()
          return true
        }
        return false
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((current) => (current + step + suggestions.length) % suggestions.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const choice = suggestions[active] ?? suggestions[0]
        if (choice) {
          insert(choice.login)
        }
        return true
      }
      if (event.key === 'Escape') {
        setQuery(null)
        return true
      }
      return false
    }
  })

  const extensions = useMemo(
    () => [
      ReviewAssetUpload.configure({
        isEnabled: () => uploadsEnabled.current,
        onUploadingChange: (uploading) => uploadingHandler.current?.(uploading)
      }),
      ReviewMention.configure({
        onQueryChange: (next) => {
          setQuery((current) => (sameQuery(current, next) ? current : next))
          setActive(0)
        },
        onKeyDown: (event) => keyHandler.current(event),
        onEditor: (editor) => {
          editorRef.current = editor
        }
      })
    ],
    []
  )

  const list =
    open && query ? (
      <GitHubMentionList
        options={suggestions}
        activeIndex={active}
        anchor={query}
        onPick={(option) => insert(option.login)}
      />
    ) : null

  return (
    <div
      className={cn('min-w-0', className)}
      {...(uploads ? { 'data-review-asset-drop': '' } : {})}
    >
      <GitHubMarkdownComposer
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onSubmitShortcut={onSubmitShortcut}
        minHeightClassName={minHeightClassName}
        editorExtensions={extensions}
        growWithContent
        showToolbar={false}
      />
      {list}
    </div>
  )
}
