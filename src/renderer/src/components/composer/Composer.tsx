import React, { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { ReviewMarkdownComposer } from '@/components/github/ReviewMarkdownComposer'
import { composerFeatures, type ComposerContext } from './composer-features'

export type ComposerProps = {
  context: ComposerContext
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Cmd/Ctrl+Enter. */
  onSubmit?: () => void
  /** Escape, when no suggestion list is open. */
  onCancel?: () => void
  /** The workspace whose files `@` names in an agent note; the active one when left out. */
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
  className
}: ComposerProps): React.JSX.Element {
  const activeWorktreeId = useAppStore((state) => state.activeWorktreeId)
  const features = composerFeatures(context, worktreeId ?? activeWorktreeId ?? null)
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
        uploads={features.uploads}
        className={className}
      />
    </div>
  )
}
