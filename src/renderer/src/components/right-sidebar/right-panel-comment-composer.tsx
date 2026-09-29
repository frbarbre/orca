import React, { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { cn } from '@/lib/utils'
import {
  getCommentBodySubmitState,
  hasBoundedCommentBodyText
} from '@/lib/comment-body-submit-state'
import { translate } from '@/i18n/i18n'
import { ReviewMarkdownComposer } from '@/components/github/ReviewMarkdownComposer'

export type RightPanelCommentSubmitResult = { ok: true } | { ok: false; error: string }

type RightPanelCommentComposerProps = {
  placeholder: string
  submitLabel: string
  onSubmit: (body: string) => Promise<RightPanelCommentSubmitResult>
  disabled?: boolean
  disabledReason?: string
  autoFocus?: boolean
  className?: string
  onCancel?: () => void
}

export function RightPanelCommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
  disabled,
  disabledReason,
  autoFocus,
  className,
  onCancel
}: RightPanelCommentComposerProps): React.JSX.Element {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const isMac = navigator.userAgent.includes('Mac')

  const stopPropagation = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  const submit = useCallback(async () => {
    const bodyState = getCommentBodySubmitState(body)
    if (bodyState.status === 'empty' || submitting || disabled || uploading) {
      return
    }
    if (bodyState.status === 'too-large-leading-whitespace') {
      setError(
        translate(
          'auto.components.right.sidebar.right.panel.comment.composer.commentTooLarge',
          'Comment is too large to submit safely.'
        )
      )
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await onSubmit(bodyState.body)
      if (result.ok) {
        setBody('')
        onCancel?.()
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setSubmitting(false)
    }
  }, [uploading, body, disabled, onCancel, onSubmit, submitting])
  const canSubmitComment = hasBoundedCommentBodyText(body)

  return (
    <div
      className={cn(
        // Why no border and a gap: the composer opens inside a comment that already has its own
        // edges, so a box around it reads as a focus ring that never turns off, and flush against
        // the comment above it the two run together.
        'mt-2 min-w-0 overflow-hidden rounded-md bg-muted',
        className
      )}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div title={disabled ? disabledReason : undefined} aria-invalid={Boolean(error)}>
        <ReviewMarkdownComposer
          value={body}
          onChange={setBody}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled || submitting}
          onUploadingChange={setUploading}
          onSubmitShortcut={() => void submit()}
          minHeightClassName="min-h-20"
          className="[&_.github-markdown-composer]:rounded-none [&_.github-markdown-composer]:border-0 [&_.github-markdown-composer]:bg-transparent [&_.github-markdown-composer]:shadow-none"
        />
      </div>
      {error && (
        <div className="border-t border-border px-2.5 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      )}
      <div className="flex min-w-0 items-center justify-end gap-1 border-t border-border px-2 py-1.5">
        {onCancel && (
          <Button type="button" variant="ghost" size="xs" disabled={submitting} onClick={onCancel}>
            {translate(
              'auto.components.right.sidebar.right.panel.comment.composer.9bca633dee',
              'Cancel'
            )}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="xs"
              aria-label={submitLabel}
              disabled={disabled || submitting || !canSubmitComment || uploading}
              onClick={() => void submit()}
            >
              {submitting
                ? translate(
                    'auto.components.right.sidebar.right.panel.comment.composer.87aff03d63',
                    'Sending...'
                  )
                : submitLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {disabled && disabledReason ? (
              <span>{disabledReason}</span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{submitLabel}</span>
                <ShortcutKeyCombo
                  keys={[isMac ? '⌘' : 'Ctrl', 'Enter']}
                  className="shrink text-[10px] [&_span]:min-w-0 [&_span]:px-1"
                  separatorClassName="mx-0 text-[10px] text-muted-foreground"
                />
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
