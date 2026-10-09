import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { GitHubMarkdownComposer } from './GitHubMarkdownComposer'
import { filterGitHubMentionOptions } from './github-mention-option-filter'
import { GitHubMentionList, useActiveRepoMentionOptions } from './github-mention-autocomplete'
import { ReviewAssetUpload } from './review-asset-upload-extension'
import { useAppStore } from '@/store'
import { usePRCommentScope } from '@/components/pr-comments/use-pr-comment-scope'
import { ReviewMention, type MentionQueryState } from './review-mention-extension'
import { ReviewEmojiShortcode } from './review-emoji-shortcode-extension'
import { searchCommentEmoji } from './emoji-shortcode-query'
import { EmojiShortcodeList } from './emoji-shortcode-list'
import { useReviewAssetDropClaim } from './review-asset-drop-claim'

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
  className
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
}): React.JSX.Element {
  const [query, setQuery] = useState<MentionQueryState | null>(null)
  const [active, setActive] = useState(0)
  const queryRef = useRef<MentionQueryState | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const dropRootRef = useRef<HTMLDivElement | null>(null)
  useReviewAssetDropClaim(dropRootRef, uploads)
  const options = useActiveRepoMentionOptions(mentions && query !== null)
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const scope = usePRCommentScope(activeWorktreeId)
  const uploadTarget = useRef({ repo: scope.repo, prRepo: scope.pr?.prRepo })
  const suggestions = useMemo(
    () => (mentions && query ? filterGitHubMentionOptions([...options], query.query) : []),
    [mentions, options, query]
  )
  const open = suggestions.length > 0 && query !== null
  const [emojiQuery, setEmojiQuery] = useState<MentionQueryState | null>(null)
  const emojiQueryRef = useRef<MentionQueryState | null>(null)
  const emojiSuggestions = useMemo(
    () => (mentions && emojiQuery ? searchCommentEmoji(emojiQuery.query) : []),
    [mentions, emojiQuery]
  )
  const emojiOpen = emojiSuggestions.length > 0 && emojiQuery !== null

  const insert = (login: string): void => {
    const editor = editorRef.current
    if (editor && query) {
      editor.chain().focus().insertContentAt({ from: query.from, to: query.to }, `@${login} `).run()
    }
    setQuery(null)
  }

  const insertEmoji = (emoji: string): void => {
    const editor = editorRef.current
    if (editor && emojiQuery) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: emojiQuery.from, to: emojiQuery.to }, `${emoji} `)
        .run()
    }
    setEmojiQuery(null)
  }

  // Why refs: the extensions are built once so the editor is never recreated.
  const keyHandler = useRef<(event: KeyboardEvent) => boolean>(() => false)
  const uploadingHandler = useRef(onUploadingChange)
  const [extensionUploading, setExtensionUploading] = useState(false)
  // Why the body check too: a local preview link in the markdown means an upload has not landed,
  // whatever the counter says, and sending it would post a link nobody else can open.
  const blocked = extensionUploading || value.includes('](blob:')
  useEffect(() => {
    uploadingHandler.current?.(blocked)
  }, [blocked])
  const uploadsEnabled = useRef(uploads)
  useEffect(() => {
    uploadingHandler.current = onUploadingChange
    uploadsEnabled.current = uploads
    uploadTarget.current = { repo: scope.repo, prRepo: scope.pr?.prRepo }
    keyHandler.current = (event) => {
      if (emojiOpen) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const step = event.key === 'ArrowDown' ? 1 : -1
          setActive(
            (current) => (current + step + emojiSuggestions.length) % emojiSuggestions.length
          )
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const choice = emojiSuggestions[active] ?? emojiSuggestions[0]
          if (choice) {
            insertEmoji(choice.emoji)
          }
          return true
        }
        if (event.key === 'Escape') {
          setEmojiQuery(null)
          return true
        }
        return false
      }
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
        onUploadingChange: setExtensionUploading,
        // Why the pull request's repository first: a fork's pull request lives upstream, and the
        // attachment has to belong to the repository its comment is posted on.
        resolveRepo: async () => {
          const { repo, prRepo } = uploadTarget.current
          if (prRepo) {
            return prRepo
          }
          return repo
            ? await window.api.gh
                .repoSlug({ repoPath: repo.path, repoId: repo.id })
                .catch(() => null)
            : null
        }
      }),
      ReviewMention.configure({
        onQueryChange: (next) => {
          if (sameQuery(queryRef.current, next)) {
            return
          }
          queryRef.current = next
          setQuery(next)
          setActive(0)
        },
        onKeyDown: (event) => keyHandler.current(event),
        onEditor: (editor) => {
          editorRef.current = editor
        }
      }),
      ReviewEmojiShortcode.configure({
        onQueryChange: (next) => {
          if (sameQuery(emojiQueryRef.current, next)) {
            return
          }
          emojiQueryRef.current = next
          setEmojiQuery(next)
          setActive(0)
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
    ) : emojiOpen && emojiQuery ? (
      <EmojiShortcodeList
        suggestions={emojiSuggestions}
        query={emojiQuery.query}
        activeIndex={active}
        anchor={emojiQuery}
        onPick={(suggestion) => insertEmoji(suggestion.emoji)}
      />
    ) : null

  return (
    <div
      ref={dropRootRef}
      className={cn('review-markdown-composer min-w-0', className)}
      {...(uploads ? { 'data-review-asset-drop': '' } : {})}
    >
      <GitHubMarkdownComposer
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onSubmitShortcut={onSubmitShortcut}
        minHeightClassName=""
        editorExtensions={extensions}
        growWithContent
        showToolbar={false}
      />
      {list}
    </div>
  )
}
