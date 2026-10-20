import React, { useContext, useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { ReviewMarkdownComposer } from '@/components/github/ReviewMarkdownComposer'
import { composerFeatures, type ComposerContext } from './composer-features'
import { ComposerSurfaceContext } from './composer-surface'
import type { MentionOption } from '@/components/pull-request-page/page-types'

export type ComposerProps = {
  context: ComposerContext
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Cmd/Ctrl+Enter. */
  onSubmit?: () => void
  /** Escape, when no suggestion list is open. */
  onCancel?: () => void
  /** The workspace whose files `@` names, none when null; left out, the surface's (see ComposerSurfaceContext). */
  worktreeId?: string | null
  /** Longest text kept; typing past it is cut off. */
  maxLength?: number
  /** Called when the box's height changes, for hosts that lay out around it. */
  onHeightChange?: (height: number) => void
  onUploadingChange?: (uploading: boolean) => void
  autoFocus?: boolean
  disabled?: boolean
  /** The box's accessible name; the placeholder when left out. */
  ariaLabel?: string
  /** Who `@` suggests in GitHub boxes; else the surface's, else the active workspace's repository and PR people. */
  people?: readonly MentionOption[]
  /** The formatting toolbar and Write/Preview tabs, for long-form boxes like a description. */
  toolbar?: boolean
  minHeightClassName?: string
  className?: string
}

/**
 * Fork: the one text box for writing to a person or an agent. What it offers follows from
 * `context` (see composerFeatures), so every box in a context gains a feature at once.
 */
export function Composer({
  context,
  value,
  onChange,
  placeholder,
  onSubmit,
  onCancel,
  worktreeId,
  maxLength,
  onHeightChange,
  onUploadingChange,
  autoFocus,
  disabled,
  ariaLabel,
  people,
  toolbar,
  minHeightClassName,
  className
}: ComposerProps): React.JSX.Element {
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const surface = useContext(ComposerSurfaceContext)
  const features = composerFeatures(
    context,
    worktreeId !== undefined
      ? worktreeId
      : surface
        ? surface.worktreeId
        : (activeWorktreeId ?? null)
  )
  const rootRef = useRef<HTMLDivElement | null>(null)
  const heightListener = useRef(onHeightChange)
  heightListener.current = onHeightChange

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() =>
      heightListener.current?.(root.getBoundingClientRect().height)
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="min-w-0" data-composer={context}>
      <ReviewMarkdownComposer
        value={value}
        onChange={(next) =>
          onChange(
            maxLength !== undefined && next.length > maxLength ? next.slice(0, maxLength) : next
          )
        }
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        onSubmitShortcut={onSubmit}
        onEscape={onCancel}
        onUploadingChange={onUploadingChange}
        autoFocus={autoFocus}
        disabled={disabled}
        mentions
        userMentions={features.userMentions}
        fileMentionWorktreeId={features.fileMentionWorktreeId}
        fileMentionLinks={features.fileMentionLinks}
        people={people ?? surface?.people}
        uploads={features.uploads}
        toolbar={toolbar}
        minHeightClassName={minHeightClassName}
        className={className}
      />
    </div>
  )
}
